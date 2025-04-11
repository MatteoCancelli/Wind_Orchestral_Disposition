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

function writeLabel(svgGroup, cx, cy, rInner, rOuter, startAngle, endAngle, name, abbreviations, svgPixelWidth) {
  const fontSizePx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--text-font-size')) || 22;
  const labelAngle = (startAngle + endAngle) / 2;
  const labelPos = polarToCartesian(cx, cy, (rInner + rOuter) / 2, labelAngle % 360);
  const arcLength = ((endAngle - startAngle + 360) % 360) * Math.PI * ((rOuter + rInner) / 2) / 180;
  const scaleFactor = svgPixelWidth / 1000;
  const realArcLength = arcLength * scaleFactor;
  const arcHeight = (rOuter - rInner) * scaleFactor;

  const approxTextWidth = Math.max(...name.split(" ").map(w => w.length)) * fontSizePx * 0.6;
  const approxTextHeight = name.split(" ").length * fontSizePx * 1.6;

  let labelLines;
  if (realArcLength < approxTextWidth || arcHeight < approxTextHeight) {
    labelLines = [abbreviations[0]];
  } else {
    labelLines = name.split(" ");
  }

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", labelPos.x);
  text.setAttribute("y", labelPos.y);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("dominant-baseline", "middle");

  labelLines.forEach((line, i) => {
    const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
    tspan.setAttribute("x", labelPos.x);
    tspan.setAttribute("dy", i === 0 ? "0" : "1.2em");
    tspan.textContent = line;
    text.appendChild(tspan);
  });

  svgGroup.appendChild(text);
}

function setupImageContainer() {
  let container = document.getElementById("instrument-image-container");
  
  if (!container) {
    container = document.createElement("div");
    container.id = "instrument-image-container";
    container.style.position = "absolute";
    container.style.display = "none";
    container.style.zIndex = "1000";
    container.style.backgroundColor = "white";
    container.style.border = "1px solid #ccc";
    container.style.borderRadius = "5px";
    container.style.padding = "5px";
    container.style.boxShadow = "0 2px 10px rgba(0, 0, 0, 0.2)";
    container.style.maxWidth = "210px";
    container.style.maxHeight = "210px";
    container.style.overflow = "hidden";
    
    document.body.appendChild(container);
  }
  
  return container;
}

function createPreloadContainer() {
  let preloadDiv = document.getElementById("instrument-images-preload");
  if (!preloadDiv) {
    preloadDiv = document.createElement("div");
    preloadDiv.id = "instrument-images-preload";
    preloadDiv.style.display = "none";
    document.body.appendChild(preloadDiv);
  }
  return preloadDiv;
}

function preloadInstrumentImage(instrument, preloadDiv) {
  if (!instrument.pic || instrument.pic.trim() === "") {
    return null;
  }
  
  const imgId = `img-${instrument.abbreviations[0]}`;
  
  let img = document.getElementById(imgId);
  if (!img) {
    img = document.createElement("img");
    img.id = imgId;
    img.alt = instrument.name;
    img.style.maxWidth = "200px";
    img.style.maxHeight = "200px";
    img.src = instrument.pic;
    
    preloadDiv.appendChild(img);
  }
  
  return imgId;
}

function preloadInstrumentImages(instruments) {
  const preloadDiv = createPreloadContainer();
  const imageMap = {};
  
  instruments.forEach((instrument) => {
    const imgId = preloadInstrumentImage(instrument, preloadDiv);
    if (imgId) {
      imageMap[instrument.abbreviations[0]] = imgId;
    }
  });
  
  return imageMap;
}

function handleSectionMouseEnter(event, path, imageMap, imageContainer) {
  if (path.dataset.hasPic === "true") {
    const abbr = path.dataset.abbr;
    
    if (imageMap[abbr]) {
      displayInstrumentImage(abbr, imageMap, path.dataset.name, imageContainer, event);
    }
  }
}

function handleSectionMouseMove(event, imageContainer) {
  if (imageContainer.style.display === "block") {
    updateImageContainerPosition(imageContainer, event);
  }
}

function handleSectionMouseLeave(imageContainer) {
  imageContainer.style.display = "none";
}

function displayInstrumentImage(abbr, imageMap, instrumentName, imageContainer, event) {
  const originalImg = document.getElementById(imageMap[abbr]);
  
  if (originalImg.complete && originalImg.naturalWidth > 0) {
    imageContainer.innerHTML = "";
    const imgClone = originalImg.cloneNode(true);
    imgClone.style.display = "block";
    imageContainer.appendChild(imgClone);
  } else {
    imageContainer.innerHTML = `<div style="padding: 10px; text-align: center;">${instrumentName}</div>`;
  }
  
  updateImageContainerPosition(imageContainer, event);
  imageContainer.style.display = "block";
}

function updateImageContainerPosition(container, event) {
  container.style.left = (event.clientX + 10) + "px";
  container.style.top = (event.clientY + 10) + "px";
}

function createSectionPath(cx, cy, rowDimensions, instrument) {
  const rowIndex = parseInt(instrument.rowNumber) - 1;
  if (rowIndex < 0 || rowIndex >= rowDimensions.length) return null;

  const { rInner, rOuter } = rowDimensions[rowIndex];
  const startAngle = parseFloat(instrument.startAngle);
  const endAngle = parseFloat(instrument.endAngle);
  if (isNaN(startAngle) || isNaN(endAngle)) return null;

  return {
    pathData: describeSection(cx, cy, rOuter, rInner, startAngle % 360, endAngle % 360),
    rInner,
    rOuter,
    startAngle,
    endAngle
  };
}

function setupSectionPath(path, instrument, imageMap, imageContainer) {
  path.setAttribute("class", "section");
  path.setAttribute("id", `instrument-${instrument.abbreviations[0]}`);
  
  path.dataset.abbr = instrument.abbreviations[0];
  path.dataset.name = instrument.name;
  path.dataset.hasPic = instrument.pic && instrument.pic.trim() !== "" ? "true" : "false";
  
  path.addEventListener("mouseenter", (event) => handleSectionMouseEnter(event, path, imageMap, imageContainer));
  path.addEventListener("mousemove", (event) => handleSectionMouseMove(event, imageContainer));
  path.addEventListener("mouseleave", () => handleSectionMouseLeave(imageContainer));
  
  return path;
}

function createInstrumentSection(instrument, svg, cx, cy, rowDimensions, imageMap, imageContainer) {
  const pathInfo = createSectionPath(cx, cy, rowDimensions, instrument);
  if (!pathInfo) return null;
  
  const group = document.createElementNS("http://www.w3.org/2000/svg", "a");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  
  path.setAttribute("d", pathInfo.pathData);
  setupSectionPath(path, instrument, imageMap, imageContainer);
  
  group.appendChild(path);
  
  writeLabel(
    group, 
    cx, 
    cy, 
    pathInfo.rInner, 
    pathInfo.rOuter, 
    pathInfo.startAngle, 
    pathInfo.endAngle, 
    instrument.name, 
    instrument.abbreviations, 
    svg.getBoundingClientRect().width
  );
  
  return group;
}

function renderSections(instruments, svg, cx, cy, rowDimensions, svgPixelWidth) {
  const validInstruments = instruments.filter(i =>
    i.startAngle !== "" && i.endAngle !== "" && i.rowNumber !== ""
  );
  
  const imageContainer = setupImageContainer();
  const imageMap = preloadInstrumentImages(validInstruments);

  validInstruments.forEach((instrument) => {
    const section = createInstrumentSection(
      instrument, 
      svg, 
      cx, 
      cy, 
      rowDimensions, 
      imageMap, 
      imageContainer
    );
    
    if (section) {
      svg.appendChild(section);
    }
  });
}

async function drawSections() {
  const instruments = await fetchData();
  const svg = document.getElementById("chart");
  svg.innerHTML = ""; 

  const bbox = svg.getBoundingClientRect(); 
  const svgPixelWidth = bbox.width; 

  const cx = 500, cy = 500; // viewBox coords
  const rowDimensions = [
    { rInner: 50, rOuter: 150 },
    { rInner: 150, rOuter: 260 },
    { rInner: 260, rOuter: 375 },
    { rInner: 375, rOuter: 500 }
  ];

  renderSections(instruments, svg, cx, cy, rowDimensions, svgPixelWidth);
}

window.addEventListener("DOMContentLoaded", drawSections);
window.addEventListener("resize", () => {
  if (document.getElementById("chart")) drawSections();
});