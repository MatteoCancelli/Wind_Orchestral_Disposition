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

function writeLabel(textElement, labelText, maxLines = 3) {
  const parts = labelText.split(" ");
  const lines = [];

  if (parts.length <= maxLines) {
    lines.push(...parts);
  } else {
    lines.push(parts.slice(0, parts.length - 1).join(" "));
    lines.push(parts[parts.length - 1]);
  }

  lines.forEach((line, i) => {
    const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", textElement.getAttribute("x"));
    tspan.setAttribute("dy", i === 0 ? "0" : "1.2em");
    tspan.textContent = line;
    textElement.appendChild(tspan);
  });
}

async function drawSections() {
  const instruments = await fetchData();

  const svg = document.getElementById("chart");
  const cx = 500, cy = 500;

  const rowDimensions = [
    { rInner: 50, rOuter: 150 },
    { rInner: 150, rOuter: 260 },
    { rInner: 260, rOuter: 375 },
    { rInner: 375, rOuter: 500 }
  ];

  const validInstruments = instruments.filter(
    instrument =>
      instrument.startAngle !== "" &&
      instrument.endAngle !== "" &&
      instrument.rowNumber !== ""
  );

  validInstruments.forEach((instrument) => {
    const rowIndex = parseInt(instrument.rowNumber) - 1;

    if (rowIndex < 0 || rowIndex >= rowDimensions.length) {
      console.error(`Not valid row number ${instrument.name}: ${instrument.rowNumber}`);
      return;
    }

    const { rInner, rOuter } = rowDimensions[rowIndex];
    const startAngle = parseFloat(instrument.startAngle);
    const endAngle = parseFloat(instrument.endAngle);

    if (isNaN(startAngle) || isNaN(endAngle)) {
      console.error(`Not valid angle ${instrument.name}: startAngle=${instrument.startAngle}, endAngle=${instrument.endAngle}`);
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

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("class", "section");
    path.setAttribute("id", `instrument-${instrument.abbreviations[0]}`);

    const labelAngle = (startAngle + endAngle) / 2;
    const label = polarToCartesian(
      cx,
      cy,
      (rOuter + rInner) / 2,
      labelAngle % 360
    );

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", label.x);
    text.setAttribute("y", label.y);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");

    const labelText = instrument.name.length > 17 && instrument.abbreviations.length > 0
      ? instrument.abbreviations[0]
      : instrument.name;
    writeLabel(text, labelText);

    group.appendChild(path);
    group.appendChild(text);
    svg.appendChild(group);
  });
}

document.addEventListener("DOMContentLoaded", drawSections);