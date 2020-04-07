// @ts-check
const fs = require('fs').promises;
const path = require('path');
const execa = require('execa');
const core = require("@actions/core");
const YAML = require('yaml');

/**
 * Writes out the kube config and sets the appropriate outputs and env vars.
 * @param {string} kubeConfig The base64 kube config to use to connect to the cluster
 * @param {boolean} setEnv Whether or not to export the kube config path;
 */
export async function initKubeConfig(kubeConfig, setEnv) {
    const kubeDir = path.join(process.env.GITHUB_WORKSPACE, '.kube/');
    await fs.mkdir(kubeDir);

    const tempDir = await fs.mkdtemp(`${kubeDir}/`);
    const configPath = path.join(tempDir, 'config.yaml');
    const configYaml = Buffer.from(kubeConfig, 'base64').toString('utf-8');
    verifyAndOutputConfig(configYaml);

    await fs.writeFile(configPath, configYaml);
    core.info(`Kube Config written to ${configPath}`);

    const { stdout, stderr, exitCode } = await execa.command(`kubectl version --kubeconfig=${configPath}`);
    if (stdout) {
        console.info(stdout);
    }
    if (stderr) {
        console.info(stderr);
    }
    if (exitCode !== 0) {
        throw Error(`There was an issue testing the kube connection. Exit Code: ${exitCode}`);
    }

    return configPath;
}

/**
 * Verifies that the received config is valid and contains the correct auth information.
 * @param {string} rawConfigYaml 
 */
function verifyAndOutputConfig(rawConfigYaml) {
    const configData = YAML.parse(rawConfigYaml);
    const targetContextName = configData['current-context'];
    const targetContext = configData['contexts'].find(context => context.name === targetContextName);
    if (!targetContext) {
        new Error('Received invalid config. Must specify context.');
    }
    const { context } = targetContext;

    core.debug(`Connecting to cluster: ${context.cluster}`);
    core.debug(`Connecting with user: ${context.user}`);

    const targetUser = configData['users'].find(user => user.name === context.user);
    if (targetUser) {
        new Error('Received invalid config. Must specify user.');
    }
    const { user } = targetUser;
    if (!user.token && !(!!user['client-certificate-data'] && !!user['client-key-data'])) {
        new Error('Target kube user does not specify a token or certificate data.');
    }

    if (user.token) {
        const { token } = user;
        core.setSecret(user.token);
        core.setOutput('token', token);
    } else {
        core.setSecret(user['client-certificate-data']);
        core.setOutput('clientCertificateData', user['client-certificate-data']);
        core.setSecret(user['client-key-data']);
        core.setOutput('clientKeyData', user['client-key-data']);
    }
}