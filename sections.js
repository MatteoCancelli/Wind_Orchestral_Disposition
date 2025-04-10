async function fetchData() {
  const response = await fetch("instruments.json");
  const data = await response.json();
  return data;
}

function polarToCartesian(cx, cy, r, angle) {
  const rad = ((angle - 90) * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

function describeSection(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);

  const largeArc = (endAngle - startAngle + 360) % 360 > 180 ? 1 : 0;

  return `
M ${p1.x},${p1.y}
A ${rOuter},${rOuter} 0 ${largeArc},1 ${p2.x},${p2.y}
L ${p3.x},${p3.y}
A ${rInner},${rInner} 0 ${largeArc},0 ${p4.x},${p4.y}
Z
`;
}

async function drawSections() {
  const instruments = await fetchData();
  
  const svg = document.getElementById("chart");
  const cx = 500, cy = 500;
  
  // Definizione delle dimensioni per ogni riga
  const rowDimensions = [
    { rInner: 50, rOuter: 150 },   // Riga 1
    { rInner: 150, rOuter: 260 },  // Riga 2
    { rInner: 260, rOuter: 375 },  // Riga 3
    { rInner: 375, rOuter: 500 }   // Riga 4
  ];

  // Filtra solo gli strumenti che hanno startAngle, endAngle e rowNumber definiti
  const validInstruments = instruments.filter(
    instrument => 
      instrument.startAngle !== "" && 
      instrument.endAngle !== "" && 
      instrument.rowNumber !== ""
  );

  validInstruments.forEach((instrument, index) => {
    const rowIndex = parseInt(instrument.rowNumber) - 1;
    
    // Verifica che il rowNumber sia valido
    if (rowIndex < 0 || rowIndex >= rowDimensions.length) {
      console.error(`Numero di riga non valido per ${instrument.name}: ${instrument.rowNumber}`);
      return;
    }
    
    const { rInner, rOuter } = rowDimensions[rowIndex];
    const startAngle = parseFloat(instrument.startAngle);
    const endAngle = parseFloat(instrument.endAngle);
    
    // Verifica che startAngle e endAngle siano numeri validi
    if (isNaN(startAngle) || isNaN(endAngle)) {
      console.error(`Angoli non validi per ${instrument.name}: startAngle=${instrument.startAngle}, endAngle=${instrument.endAngle}`);
      return;
    }
    
    const pathData = describeSection(
      cx,
      cy,
      rOuter,
      rInner,
      startAngle % 360,
      endAngle % 360
    );

    const group = document.createElementNS("http://www.w3.org/2000/svg", "a");
    // Usa il link dal JSON se disponibile
    if (instrument.link && instrument.link !== "") {
      group.setAttribute("href", instrument.link);
    } else {
      // Fallback al link predefinito
      group.setAttribute("href", `/strumenti/${instrument.abbreviations[0]}.html`);
    }

    const path = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "path"
    );
    path.setAttribute("d", pathData);
    path.setAttribute("class", "section");
    path.setAttribute("id", `instrument-${instrument.abbreviations[0]}`);

    // Calcola la posizione del testo al centro della sezione
    const labelAngle = (startAngle + endAngle) / 2;
    const label = polarToCartesian(
      cx,
      cy,
      (rOuter + rInner) / 2,
      labelAngle % 360
    );
    
    const text = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "text"
    );
    text.setAttribute("x", label.x);
    text.setAttribute("y", label.y);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.textContent = instrument.name;

    group.appendChild(path);
    group.appendChild(text);
    svg.appendChild(group);
  });
}

// Chiama la funzione per disegnare le sezioni quando il documento è caricato
document.addEventListener("DOMContentLoaded", drawSections);