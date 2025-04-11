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

function setupModal() {
  let modal = document.getElementById("instrument-modal");
  
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "instrument-modal";
    
    const modalContent = document.createElement("div");
    modalContent.className = "modal-content";
    
    const closeButton = document.createElement("span");
    closeButton.className = "close-button";
    closeButton.innerHTML = "&times;";
    closeButton.onclick = function() {
      modal.style.display = "none";
    };
    
    const modalImage = document.createElement("img");
    modalImage.id = "modal-instrument-image";
    modalImage.alt = "Instrument Image";
    
    const modalTitle = document.createElement("h2");
    modalTitle.id = "modal-instrument-title";
    
    const modalButton = document.createElement("button");
    modalButton.id = "modal-instrument-button";
    modalButton.textContent = "Vai alla pagina dello strumento";
    
    modalContent.appendChild(closeButton);
    modalContent.appendChild(modalImage);
    modalContent.appendChild(modalTitle);
    modalContent.appendChild(modalButton);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
    
    window.onclick = function(event) {
      if (event.target === modal) {
        modal.style.display = "none";
      }
    };
  }
  
  return modal;
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
    img.style.maxWidth = "100%";
    img.style.maxHeight = "300px";
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

function showInstrumentModal(instrument, imageMap) {
  const modal = document.getElementById("instrument-modal");
  const modalImage = document.getElementById("modal-instrument-image");
  const modalTitle = document.getElementById("modal-instrument-title");
  const modalButton = document.getElementById("modal-instrument-button");
  
  modalTitle.textContent = instrument.name;
  
  if (instrument.pic && instrument.pic.trim() !== "" && imageMap[instrument.abbreviations[0]]) {
    const originalImg = document.getElementById(imageMap[instrument.abbreviations[0]]);
    modalImage.src = originalImg.src;
    modalImage.style.display = "block";
  } else {
    modalImage.style.display = "none";
  }
  
  modalButton.onclick = function() {
    window.location.href = `/instrument.html?id=${instrument.abbreviations[0]}`;
  };
  
  modal.style.display = "block";
}

function renderSections(instruments, svg, cx, cy, rowDimensions, svgPixelWidth) {
  const validInstruments = instruments.filter(i =>
    i.startAngle !== "" && i.endAngle !== "" && i.rowNumber !== ""
  );
  
  setupModal();
  
  const imageMap = preloadInstrumentImages(validInstruments);

  validInstruments.forEach((instrument) => {
    const rowIndex = parseInt(instrument.rowNumber) - 1;
    if (rowIndex < 0 || rowIndex >= rowDimensions.length) return;

    const { rInner, rOuter } = rowDimensions[rowIndex];
    const startAngle = parseFloat(instrument.startAngle);
    const endAngle = parseFloat(instrument.endAngle);
    if (isNaN(startAngle) || isNaN(endAngle)) return;

    const pathData = describeSection(cx, cy, rOuter, rInner, startAngle % 360, endAngle % 360);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "a");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

    path.setAttribute("d", pathData);
    path.setAttribute("class", "section");
    path.setAttribute("id", `instrument-${instrument.abbreviations[0]}`);
    
    path.addEventListener("click", function() {
      showInstrumentModal(instrument, imageMap);
    });
    
    group.appendChild(path);
    writeLabel(group, cx, cy, rInner, rOuter, startAngle, endAngle, instrument.name, instrument.abbreviations, svgPixelWidth);
    svg.appendChild(group);
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