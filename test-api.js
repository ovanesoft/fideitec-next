const http = require('http');

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiIxNGUzOTUyNy1hMDZkLTQ5NDAtOTMxOC0wYzdjOWZkMmYyNjciLCJlbWFpbCI6Im5pY29sYXNAZGVsZWdhbGVzLmNvbSIsInJvbGUiOiJhZG1pbiIsInRlbmFudElkIjoiZDJkYjY3ODItM2MyYS00YWVkLWE1NDItYjM5OTQwNjBkN2JhIiwiaWF0IjoxNzY3NDA0OTI3LCJleHAiOjE3NjgwMDk3MjcsImF1ZCI6Im5pY3JvbWEtdXNlcnMiLCJpc3MiOiJuaWNyb21hLmNvbSJ9.vpjO2IG9o2EMPn-88Wvjq6znvoH1UumjiXI7pGiM6sc';

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/suppliers',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error('Error:', e.message);
});

req.end();

