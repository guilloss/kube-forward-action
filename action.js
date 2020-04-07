import { initKubeConfig } from './initKubeconfig';

// @ts-check
const fetch = require('node-fetch');
const pRetry = require('p-retry');
const execa = require('execa');
const core = require("@actions/core");

(async () => {
    let kubeconfig = core.getInput('kubeconfig', { required: false });
    const kubeconfigData = core.getInput('kubeconfig-data', { required: false });
    const targetRef = core.getInput('targetRef', { required: true });
    const namespace = core.getInput('namespace', { required: false }) || 'default';
    const port = core.getInput('port', { required: true });
    const targetPort = core.getInput('targetPort', { required: false }) || port;
    const healthCheck = core.getInput('healthCheck', { required: false });

    if (!kubeconfig && !kubeconfigData) {
        throw Error('You must provide either kubeconfig or kubeconfigData.');
    }

    if (kubeconfigData) {
        kubeconfig = await core.group('Writing out kube config...', () => initKubeConfig(kubeconfig))
    }
    process.env['KUBECONFIG'] = kubeconfig;

    core.startGroup('Starting port-forward...');

    const [kind, name] = targetRef.split('/');
    const getCmd = `kubectl get ${kind} --namespace=${namespace} -o json`;
    core.info(`cmd: ${getCmd}`);
    const { stdout: output, stderr: error } = await execa.command(getCmd);

    if (error) {
        console.error(error);
    }
    const { items } = JSON.parse(output);
    
    const target = items.find(item => item.metadata.name == name);
    if (!target) {
        core.error(`Unable to start proxy. No ${kind} with name ${name} found.`);
        process.exitCode = 1;
        return;
    } else {
        core.debug('Found target');
    }

    const command = `kubectl port-forward --namespace=${namespace} ${targetRef} ${port}:${targetPort}`;
    core.info(`cmd: ${command}`);
    const kubectl = execa.command(command, {
        detached: true,
        stdio: 'ignore',
        cleanup: 'false'
    });

    // Wait a second to allow the port-forward to connect.
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
        await pRetry(async () => {
            const response = await fetch(`http://localhost:${port}/${healthCheck}`);
            if (response.status < 200 || response.stats >= 400) {
                throw new Error(`Failed to connect: ${response.statusText}`)
            }
        }, {
            retries: 3,
            onFailedAttempt: retry => core.info(JSON.stringify(retry))
        });
    } catch (e) {
        core.error('Failed to start port-forward.');
        kubectl.kill('SIGTERM');
        throw e;
    }
    
    core.endGroup();
    if (kubectl.connected) {
        kubectl.disconnect();
    }
    kubectl.unref();
    await kubectl;

    core.setOutput('port', port);
    core.setOutput('pid', kubectl.pid);
    core.setOutput('kubeconfig', kubeconfig);
})().catch(e => {
    console.error(e);
    process.exitCode = 1;
});