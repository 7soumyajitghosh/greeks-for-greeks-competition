const line = '1.2.3.4 - - [15/Jan/2024:10:23:45 +0000] "GET / 200 1';
// After the quote group matched "GET /", what's left?
const after = line.slice(line.indexOf('"GET /') + 7);
console.log('after JSON:', JSON.stringify(after));
console.log('char codes:', [...after].map((c) => c.charCodeAt(0)));

// Test just the tail
const tail = '"GET / 200 1';
console.log('tail status:', /"([^"]*)"\s+(\d{3})\s+(\S+)/.exec(tail));
