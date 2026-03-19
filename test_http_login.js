const http = require('http');

const payload = {
  email: String(process.env.TEST_USER_EMAIL || '').trim(),
  password: String(process.env.TEST_USER_PASSWORD || '').trim()
};

if (!payload.email || !payload.password) {
  throw new Error('Define TEST_USER_EMAIL y TEST_USER_PASSWORD antes de ejecutar este script.');
}

const data = JSON.stringify(payload);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  console.log(`StatusCode: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  res.on('data', d => {
    process.stdout.write(d);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();
