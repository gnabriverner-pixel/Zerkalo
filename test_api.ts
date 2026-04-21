async function test() {
  const res = await fetch('http://localhost:3000/api/generate-reading', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: "06.05.1986",
      calc: {
        soul: 6, soulComposite: "6",
        path: 8, pathComposite: "35/8",
        direction: 5, directionComposite: "41/5",
        expression: 2, expressionComposite: "11/2",
        result: 1, resultComposite: "82/10/1",
        detailedMatrix: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "8": 0, "9": 0, "0": 0 }
      }
    })
  });
  const data = await res.json();
  console.log(data);
}
test();
