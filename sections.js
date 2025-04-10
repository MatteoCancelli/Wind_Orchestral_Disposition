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
  const data = await fetchData();

  const svg = document.getElementById("chart");
  const cx = 500,
    cy = 500;
  const bands = [
    { count: 3, rInner: 50, rOuter: 150 },
    { count: 5, rInner: 150, rOuter: 260 },
    { count: 5, rInner: 260, rOuter: 375 },
    { count: 4, rInner: 375, rOuter: 500 },
  ];

  let sectionIndex = 1;
  bands.forEach((band) => {
    const totalAngle = 180;
    const startOffset = 270; // Start from 270° to go clockwise to 90°
    const angleStep = totalAngle / band.count;
    for (let i = 0; i < band.count; i++) {
      const startAngle = startOffset + i * angleStep;
      const endAngle = startOffset + (i + 1) * angleStep;
      const pathData = describeSection(
        cx,
        cy,
        band.rOuter,
        band.rInner,
        startAngle % 360,
        endAngle % 360
      );

      const group = document.createElementNS("http://www.w3.org/2000/svg", "a");
      group.setAttribute("href", `/strumenti/strumento${sectionIndex}.html`);

      const path = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
      path.setAttribute("d", pathData);
      path.setAttribute("class", "section");

      const labelAngle = (startAngle + endAngle) / 2;
      const label = polarToCartesian(
        cx,
        cy,
        (band.rOuter + band.rInner) / 2,
        labelAngle % 360
      );
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("x", label.x);
      text.setAttribute("y", label.y);
      if (data[sectionIndex - 1]) {
        text.textContent = data[sectionIndex - 1].name;
      } else {
        console.error("Elemento non trovato in data:", sectionIndex - 1);
      }

      group.appendChild(path);
      group.appendChild(text);
      svg.appendChild(group);

      sectionIndex++;
    }
  });
}
