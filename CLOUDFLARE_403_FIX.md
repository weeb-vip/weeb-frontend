# Fixing Cloudflare 403 Errors for SSR GraphQL Requests

## 🚨 Problem
Your SSR server is getting Cloudflare challenge pages (403 errors) when trying to fetch from `gateway.weeb.vip` because Cloudflare sees the server-to-server requests as bot traffic.

## 🛠️ Solutions (in order of preference)

### Solution 1: Whitelist Your SSR Server IPs (Recommended)

In Cloudflare Dashboard:
1. Go to **Security > WAF > Tools**
2. Create an IP Access Rule:
   - **Value**: Your SSR server's IP address(es)
   - **Action**: Allow
   - **Zone**: gateway.weeb.vip
   - **Notes**: "SSR Server Whitelist"

For Cloudflare Pages/Workers, add these IPs:
```
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
```

### Solution 2: Lower Security Level for GraphQL Endpoint

1. Go to **Security > Settings**
2. Create a Configuration Rule:
   - **Name**: "Allow GraphQL SSR"
   - **When incoming requests match**:
     - URI Path equals `/graphql`
   - **Then**:
     - Security Level: Off (or Low)
     - Browser Integrity Check: Off
     - Disable Performance features

### Solution 3: Create Page Rule for GraphQL

1. Go to **Rules > Page Rules**
2. Create rule for `gateway.weeb.vip/graphql*`
3. Settings:
   - Security Level: Essentially Off
   - Browser Integrity Check: Off
   - Always Online: Off
   - Cache Level: Bypass

### Solution 4: Use Transform Rules to Add Headers

1. Go to **Rules > Transform Rules > Request Headers**
2. Add rule:
   - **When**: URI Path equals `/graphql`
   - **Set Headers**:
     - `CF-Connecting-IP`: `preserve`
     - `X-Forwarded-For`: `preserve`

### Solution 5: Use Cloudflare Tunnel (Most Reliable)

Instead of exposing your K8s cluster directly:

1. Install cloudflared in your cluster:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cloudflared
spec:
  replicas: 1
  template:
    spec:
      containers:
      - name: cloudflared
        image: cloudflare/cloudflared:latest
        args:
        - tunnel
        - --no-autoupdate
        - run
        - --token
        - YOUR_TUNNEL_TOKEN
```

2. Create tunnel in Cloudflare Dashboard
3. Route `gateway.weeb.vip` through the tunnel
4. No more 403 errors!

### Solution 6: Add Custom Headers in SSR

Update your SSR GraphQL client to add headers that Cloudflare trusts:

```javascript
// In your SSR GraphQL client
const client = new GraphQLClient(config.graphql_host, {
  headers: {
    'User-Agent': 'WeebVIP-SSR/1.0',
    'X-Requested-With': 'XMLHttpRequest',
    'Accept': 'application/json',
    'CF-Visitor': JSON.stringify({ scheme: 'https' }),
    // Add a shared secret if you control the backend
    'X-SSR-Secret': process.env.SSR_SECRET || 'your-shared-secret'
  }
})
```

Then in Cloudflare, create a WAF rule to allow requests with this header.

## 🔍 Quick Diagnosis

Test if it's a Cloudflare issue:

```bash
# From your SSR server
curl -X POST https://gateway.weeb.vip/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# If you get HTML with "Just a moment...", it's Cloudflare challenge
```

## ⚡ Immediate Workaround

While you implement a permanent fix:

1. **Temporarily lower security**:
   - Security > Settings > Security Level: **Essentially Off**
   - Just for `/graphql` path using Configuration Rules

2. **Or disable proxy temporarily**:
   - DNS > gateway.weeb.vip > Click orange cloud (make it gray)
   - This bypasses Cloudflare but loses DDoS protection

## 🎯 Recommended Approach

1. **Short term**: Use Solution 2 (Configuration Rule for /graphql)
2. **Long term**: Implement Solution 5 (Cloudflare Tunnel) for full security

## 🔐 Security Note

When whitelisting or lowering security:
- Only apply to `/graphql` endpoint
- Consider adding authentication headers
- Monitor for abuse
- Use rate limiting on your backend