const cheerio = require('cheerio');
const fs = require('fs');

async function test() {
  const query = "Biela Motor Ford 300 F300 F150 F250 F350";
  const url = `https://listado.mercadolibre.com.ve/${encodeURIComponent(query).replace(/%20/g, '-')}`;
  
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });
    
    const html = await res.text();
    fs.writeFileSync('ml.html', html);
    console.log("Saved to ml.html");
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
