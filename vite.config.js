import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import https from 'https'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      {
        name: 'midtrans-api',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url.startsWith('/api/midtrans-token')) {
              let body = '';
              req.on('data', chunk => {
                body += chunk;
              });
              req.on('end', () => {
                try {
                  const data = JSON.parse(body || '{}');
                  const serverKey = env.MIDTRANS_SERVER_KEY || 'YOUR_MIDTRANS_SERVER_KEY';
                  const authHeader = 'Basic ' + Buffer.from(serverKey + ':').toString('base64');
                
                const postData = JSON.stringify({
                  transaction_details: {
                    order_id: data.order_id || ('PLAYLAND-' + Date.now()),
                    gross_amount: data.gross_amount || 25000
                  },
                  credit_card: {
                    secure: true
                  },
                  customer_details: {
                    first_name: data.customer_name || 'Guest'
                  },
                  callbacks: {
                    finish: data.redirect_url || 'http://localhost:5173/',
                    unfinish: data.redirect_url || 'http://localhost:5173/',
                    error: data.redirect_url || 'http://localhost:5173/'
                  }
                });

                const options = {
                  hostname: 'app.sandbox.midtrans.com',
                  port: 443,
                  path: '/snap/v1/transactions',
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': authHeader,
                    'Content-Length': Buffer.byteLength(postData)
                  }
                };

                const midtransReq = https.request(options, (midtransRes) => {
                  let resBody = '';
                  midtransRes.on('data', d => {
                    resBody += d;
                  });
                  midtransRes.on('end', () => {
                    res.writeHead(midtransRes.statusCode, { 
                      'Content-Type': 'application/json',
                      'Access-Control-Allow-Origin': '*' 
                    });
                    res.end(resBody);
                  });
                });

                midtransReq.on('error', (e) => {
                  res.writeHead(500, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: e.message }));
                });

                midtransReq.write(postData);
                midtransReq.end();

              } catch (e) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON body' }));
              }
            });
          } else {
            next();
          }
        });
      }
    }
  ]
  }
})
