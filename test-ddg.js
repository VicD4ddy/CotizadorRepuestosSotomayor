const { image_search } = require('duckduckgo-images-api');

async function test() {
  try {
    const results = await image_search({ query: "Toyota Corolla 2010 bomba de agua", moderate: true, retries: 2 });
    console.log(results.slice(0, 3));
  } catch (error) {
    console.error("Error:", error);
  }
}

test();
