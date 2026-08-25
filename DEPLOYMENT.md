# Deployment Guide - SAP BTP Kyma Runtime

## Prerequisites

1. SAP BTP account with Kyma runtime enabled
2. kubectl configured with Kyma cluster access
3. Container registry (Docker Hub, GHCR, or private registry)
4. SAP Datasphere OAuth 2.0 client credentials

## Step 1: Build and Push Docker Image

```bash
# Build the image
docker build -t YOUR_REGISTRY/sap-datasphere-mcp-v2:latest -f docker/Dockerfile .

# Push to registry
docker push YOUR_REGISTRY/sap-datasphere-mcp-v2:latest
```

## Step 2: Configure Secrets

Edit `k8s/secrets.yaml` with your Datasphere credentials:

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: datasphere-credentials
  namespace: datasphere-mcp-v2
type: Opaque
stringData:
  DATASPHERE_BASE_URL: "https://your-tenant.eu10.hcs.cloud.sap"
  DATASPHERE_CLIENT_ID: "your-client-id"
  DATASPHERE_CLIENT_SECRET: "your-client-secret"
  DATASPHERE_TOKEN_URL: "https://your-tenant.authentication.eu10.hana.ondemand.com/oauth/token"
  DATASPHERE_CLI_HOST: "https://your-tenant.eu10.hcs.cloud.sap"
```

## Step 3: Update Deployment Image

Edit `k8s/deployment.yaml` to use your registry image:

```yaml
containers:
  - name: mcp-server
    image: YOUR_REGISTRY/sap-datasphere-mcp-v2:latest
```

## Step 4: Update APIRule Domain

Edit `k8s/apirule.yaml` with your Kyma cluster domain:

```yaml
spec:
  host: datasphere-mcp-v2.YOUR_CLUSTER_DOMAIN
```

## Step 5: Deploy to Kyma

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create secrets and config
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/apirule.yaml
```

## Step 6: Verify Deployment

```bash
# Check pods
kubectl get pods -n datasphere-mcp-v2

# Check deployment status
kubectl rollout status deployment/sap-datasphere-mcp-v2 -n datasphere-mcp-v2

# Check service
kubectl get svc -n datasphere-mcp-v2

# Check API rule
kubectl get apirule -n datasphere-mcp-v2
```

## Step 7: Test the Endpoint

```bash
# Health check
curl https://datasphere-mcp-v2.YOUR_CLUSTER_DOMAIN/health

# MCP endpoint
curl -X POST https://datasphere-mcp-v2.YOUR_CLUSTER_DOMAIN/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0"}}}'
```

## Step 8: Configure LibreChat

Add to your LibreChat MCP configuration:

```json
{
  "mcpServers": {
    "sap-datasphere": {
      "type": "streamableHttp",
      "url": "https://datasphere-mcp-v2.YOUR_CLUSTER_DOMAIN/mcp"
    }
  }
}
```

## Monitoring

### Check Logs
```bash
kubectl logs -f deployment/sap-datasphere-mcp-v2 -n datasphere-mcp-v2
```

### Check Health
```bash
kubectl exec -it deployment/sap-datasphere-mcp-v2 -n datasphere-mcp-v2 -- curl localhost:8080/health
```

## Scaling

```bash
# Scale to 3 replicas
kubectl scale deployment/sap-datasphere-mcp-v2 --replicas=3 -n datasphere-mcp-v2

# Auto-scaling
kubectl autoscale deployment/sap-datasphere-mcp-v2 --min=2 --max=10 --cpu-percent=80 -n datasphere-mcp-v2
```

## Updating

```bash
# Update image tag
kubectl set image deployment/sap-datasphere-mcp-v2 mcp-server=YOUR_REGISTRY/sap-datasphere-mcp-v2:NEW_TAG -n datasphere-mcp-v2

# Watch rollout
kubectl rollout status deployment/sap-datasphere-mcp-v2 -n datasphere-mcp-v2
```

## Troubleshooting

### Pod not starting
```bash
kubectl describe pod <pod-name> -n datasphere-mcp-v2
kubectl logs <pod-name> -n datasphere-mcp-v2
```

### Connection issues
```bash
kubectl exec -it deployment/sap-datasphere-mcp-v2 -n datasphere-mcp-v2 -- curl -v https://your-tenant.eu10.hcs.cloud.sap/api/v1/spaces
```

### Python parser issues
```bash
kubectl exec -it deployment/sap-datasphere-mcp-v2 -n datasphere-mcp-v2 -- curl localhost:8100/health
```
