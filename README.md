# kube-forward-action

A simple helper action to open a port-forward to a kubernetes target.


## Reference
| Input             | Description                                                                                       | Default   | Required |
| ----------------- | ------------------------------------------------------------------------------------------------- | --------- | -------- |
| `kubeconfig`      | The path to the kube config to be used. Either kubeconfig or kubeconfig-data must be provided.    |           |          |
| `kubeconfig-data` | The base64-encoded kube config to be used. Either kubeconfig or kubeconfig-data must be provided. |           |          |
| `targetRef`       | The <kind>/<name> formatted target to open the port forward to.                                   |           | ✔        |
| `namespace`       | The namespace of the target ref.                                                                  | `default` |          |
| `targetPort`      | The port to open on the target. If not specified, port is used instead.                           |           |          |
| `port`            | The port to open locally.                                                                         |           | ✔        |
| `healthCheck`     | The endpoint path to check for health. By default, does a GET to the root path over http.         |           |          |