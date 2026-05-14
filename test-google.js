const google = require('googlethis');

async function test() {
  try {
    const options = {
      page: 0, 
      safe: false, 
      additional_params: { 
        hl: 'es' 
      }
    };
    
    // Add site:mercadolibre.com.ve to restrict to ML Venezuela
    const query = 'Bomba de agua Toyota Corolla 2010 site:mercadolibre.com.ve';
    const response = await google.image(query, options);
    console.log(response.slice(0, 3));
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
