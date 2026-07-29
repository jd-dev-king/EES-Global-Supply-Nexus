import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const fallbackUrl = '/assets/seed.json';
let dashboard;
let nodeMeshes = [];
let selectedSupplierId = null;
let workflowData = null;

const $ = (selector) => document.querySelector(selector);
const statusClass = (value) => value.toLowerCase().replaceAll(' ', '-');

async function loadDashboard() {
  try {
    const response = await fetch('/api/dashboard');
    if (!response.ok) throw new Error('API unavailable');
    return await response.json();
  } catch {
    const response = await fetch(fallbackUrl);
    const seed = await response.json();
    const suppliers = seed.suppliers;
    const shipments = seed.shipments;
    return {
      ...seed,
      kpis: {
        activeSuppliers: suppliers.length,
        openPurchaseOrders: shipments.length,
        atRiskShipments: shipments.filter(item => ['At Risk','Delayed','Quality Hold','Capacity Constraint'].includes(item.status)).length,
        supplierQuality: (suppliers.reduce((sum,item)=>sum+item.quality_score,0)/suppliers.length).toFixed(1),
        onTimeDelivery: (suppliers.reduce((sum,item)=>sum+item.delivery_score,0)/suppliers.length).toFixed(1),
        inventoryCoverage: (seed.inventory.reduce((sum,item)=>sum+item.days_cover,0)/seed.inventory.length).toFixed(1)
      }
    };
  }
}

function renderDashboard(data) {
  const kpis = [
    ['ACTIVE SUPPLIERS', data.kpis.activeSuppliers, 'qualified network'],
    ['OPEN PURCHASE ORDERS', data.kpis.openPurchaseOrders, 'live commitments'],
    ['AT-RISK SHIPMENTS', data.kpis.atRiskShipments, 'requires action'],
    ['SUPPLIER QUALITY', `${data.kpis.supplierQuality}%`, 'weighted score'],
    ['ON-TIME DELIVERY', `${data.kpis.onTimeDelivery}%`, 'rolling 90 days'],
    ['INVENTORY COVERAGE', `${data.kpis.inventoryCoverage} d`, 'average coverage']
  ];
  $('#kpis').innerHTML = kpis.map(item => `<div class="kpi-card"><span>${item[0]}</span><strong>${item[1]}</strong><small>${item[2]}</small></div>`).join('');
  const avgProgress = Math.round(data.shipments.reduce((s,x)=>s+x.progress,0)/data.shipments.length);
  $('#network-progress').style.width = `${avgProgress}%`;
  $('#briefing-copy').textContent = `${data.shipments.length} purchase orders are active across ${data.suppliers.length} qualified suppliers. ${data.kpis.atRiskShipments} shipment routes could affect manufacturing readiness.`;
  $('#po-count').textContent = `${data.shipments.length} ORDERS`;
  $('#shipments').innerHTML = data.shipments.map(s => `<tr data-supplier="${s.supplier_id}"><td>${s.po_number}</td><td>${s.material}</td><td>${s.route}</td><td><div class="mini-progress"><i style="width:${s.progress}%"></i></div><small>${s.progress}%</small></td><td><span class="status ${statusClass(s.status)}">${s.status}</span></td><td>${s.eta}</td></tr>`).join('');
  document.querySelectorAll('#shipments tr').forEach(row => row.addEventListener('click', () => selectSupplier(Number(row.dataset.supplier))));
  $('#inventory').innerHTML = data.inventory.map(i => `<div class="inventory-row"><div class="inventory-head"><span>${i.material}</span><span>${i.days_cover} DAYS</span></div><small>${i.on_hand.toLocaleString()} ${i.unit} on hand · ${i.status}</small><div class="cover-track"><i style="width:${Math.min(100,i.days_cover/35*100)}%;background:${i.status==='Critical'?'var(--bad)':i.status==='Watch'?'var(--warn)':'var(--good)'}"></i></div></div>`).join('');
  $('#events').innerHTML = data.events.map(e => `<div class="event"><i class="${e.severity==='critical'?'critical':e.severity==='warning'?'warning':'healthy'}"></i><div><h4>${e.title}</h4><p>${e.detail}</p><time>${new Date(e.occurred_at).toLocaleString()}</time></div></div>`).join('');
}

function selectSupplier(id) {
  selectedSupplierId = id;
  const s = dashboard.suppliers.find(item => item.id === id);
  const shipments = dashboard.shipments.filter(item => item.supplier_id === id);
  if (!s) return;
  const exposure = shipments.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  const orders = shipments.length
    ? shipments.map(item => `<div class="supplier-order"><strong>${item.po_number}</strong><span>${item.status} · ${item.eta}</span><small>${item.quantity.toLocaleString()} ${item.unit} · ${item.incoterm} · ${item.price_variance_pct > 0 ? '+' : ''}${item.price_variance_pct}% variance</small></div>`).join('')
    : '<p class="no-orders">No active production order. Supplier remains in qualification or contingency status.</p>';
  $('#supplier-detail').className = 'supplier-card';
  $('#supplier-detail').innerHTML = `<h3>${s.name}</h3><p>${s.city}, ${s.country} · ${s.material}</p><div class="score-row"><span>QUALITY PERFORMANCE</span><strong>${s.quality_score}%</strong><div class="score-bar"><i style="width:${s.quality_score}%"></i></div></div><div class="score-row"><span>ON-TIME DELIVERY</span><strong>${s.delivery_score}%</strong><div class="score-bar"><i style="width:${s.delivery_score}%"></i></div></div><div class="supplier-meta"><div><small>RISK LEVEL</small><strong>${s.risk}</strong></div><div><small>QUALIFICATION</small><strong>${s.status}</strong></div><div><small>ANNUAL SPEND</small><strong>$${Number(s.annual_spend).toLocaleString()}</strong></div><div><small>LEAD TIME</small><strong>${s.lead_time_days} days</strong></div><div><small>CAPACITY</small><strong>${s.capacity_utilization}%</strong></div><div><small>AUDIT</small><strong>${s.audit_status}</strong></div><div><small>OPEN ORDERS</small><strong>${shipments.length}</strong></div><div><small>OPEN EXPOSURE</small><strong>$${Math.round(exposure).toLocaleString()}</strong></div></div><div class="supplier-orders"><h4>ACTIVE COMMERCIAL ACTIVITY</h4>${orders}</div>`;
  nodeMeshes.forEach(mesh => mesh.scale.setScalar(mesh.userData.supplierId === id ? 1.8 : 1));
}

async function simulate(scenario) {
  let result;
  try {
    const response = await fetch(`/api/simulations/${scenario}`, {method:'POST'});
    if (!response.ok) throw new Error();
    result = await response.json();
  } catch {
    const fallback = {
      'port-delay':['Port congestion detected','+4.2 days lead time','Expedite packaging components through an alternate port.'],
      'quality-hold':['Incoming lot placed on quality hold','Production start at risk','Allocate approved safety stock and launch supplier deviation review.'],
      'demand-surge':['Demand forecast increased 22%','API coverage falls to 12 days and bottle demand exceeds confirmed supply','Release a secondary-source API PO, advance bottle supply, and rebalance the batch schedule.'],
      'supplier-capacity':['Packaging supplier reaches capacity ceiling','Two packaging orders compete for constrained production slots','Split volume with an alternate packaging supplier and expedite artwork approval.'],
      'alternate-source':['Primary API source interruption modeled','Single-source exposure threatens two scheduled batches','Accelerate the alternate API qualification lot and reserve safety stock for priority batches.']
    }[scenario];
    result = {headline:fallback[0],impact:fallback[1],recommendation:fallback[2]};
  }
  $('#simulation-result').innerHTML = `<strong>${result.headline}</strong><b>Calculated impact:</b> ${result.impact}<br><b>Recommended response:</b> ${result.recommendation}`;
}

function latLonToVector3(lat, lon, radius=2.02) {
  const phi = (90-lat) * Math.PI/180;
  const theta = (lon+180) * Math.PI/180;
  return new THREE.Vector3(-radius*Math.sin(phi)*Math.cos(theta), radius*Math.cos(phi), radius*Math.sin(phi)*Math.sin(theta));
}

function createScene(data) {
  const host = $('#scene');
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020a10, .07);
  const camera = new THREE.PerspectiveCamera(44, host.clientWidth/host.clientHeight, .1, 100);
  camera.position.set(0, .4, 6.1);
  const renderer = new THREE.WebGLRenderer({antialias:true,alpha:true});
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true; controls.enablePan=false; controls.minDistance=3.5; controls.maxDistance=9;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(2,72,72), new THREE.MeshPhongMaterial({color:0x082b3a,emissive:0x03151f,shininess:30,transparent:true,opacity:.95,wireframe:false}));
  scene.add(globe);
  const wire = new THREE.Mesh(new THREE.SphereGeometry(2.015,36,36), new THREE.MeshBasicMaterial({color:0x16789d,wireframe:true,transparent:true,opacity:.17}));
  scene.add(wire);
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(2.12,64,64),new THREE.MeshBasicMaterial({color:0x38cfff,transparent:true,opacity:.05,side:THREE.BackSide}));
  scene.add(atmosphere);
  scene.add(new THREE.AmbientLight(0x73dfff,1.15));
  const light = new THREE.DirectionalLight(0x8eeeff,3.2);light.position.set(4,3,5);scene.add(light);
  const site = latLonToVector3(40.14,-75.21,2.04);
  const siteGroup=new THREE.Group();siteGroup.userData.destination='pharma-twin';const siteMesh = new THREE.Mesh(new THREE.CylinderGeometry(.07,.13,.28,8),new THREE.MeshBasicMaterial({color:0xffffff}));siteMesh.position.copy(site);siteMesh.lookAt(0,0,0);siteMesh.rotateX(Math.PI/2);siteGroup.add(siteMesh);const beacon=new THREE.Mesh(new THREE.RingGeometry(.12,.18,32),new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,transparent:true,opacity:.9}));beacon.position.copy(site.clone().multiplyScalar(1.012));beacon.lookAt(camera.position);siteGroup.add(beacon);scene.add(siteGroup);
  data.suppliers.forEach(s => {
    const p = latLonToVector3(s.latitude,s.longitude,2.04);
    const color = s.risk==='High'?0xff647c:s.risk==='Medium'?0xffc45c:0x56f2aa;
    const node = new THREE.Mesh(new THREE.SphereGeometry(.055,20,20),new THREE.MeshBasicMaterial({color}));
    node.position.copy(p);node.userData.supplierId=s.id;scene.add(node);nodeMeshes.push(node);
    const halo = new THREE.Mesh(new THREE.RingGeometry(.075,.11,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.65,side:THREE.DoubleSide}));halo.position.copy(p);halo.lookAt(camera.position);scene.add(halo);
    const midpoint = p.clone().add(site).multiplyScalar(.5).normalize().multiplyScalar(2.9);
    const curve = new THREE.QuadraticBezierCurve3(p,midpoint,site);
    const supplierShipments = data.shipments.filter(item=>item.supplier_id===s.id);
    const shipment = supplierShipments.find(item=>['Delayed','Quality Hold'].includes(item.status)) || supplierShipments.find(item=>['At Risk','Capacity Constraint'].includes(item.status)) || supplierShipments[0];
    const routeColor = ['Delayed','Quality Hold'].includes(shipment?.status)?0xff647c:['At Risk','Capacity Constraint'].includes(shipment?.status)?0xffc45c:0x59ddff;
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),new THREE.LineBasicMaterial({color:routeColor,transparent:true,opacity:.62}));scene.add(line);
    if(shipment){const cargo=new THREE.Mesh(new THREE.SphereGeometry(.035,12,12),new THREE.MeshBasicMaterial({color:routeColor}));scene.add(cargo);cargo.userData={curve,offset:s.id*.12};}
  });
  const starsGeo = new THREE.BufferGeometry();const positions=[];for(let i=0;i<1300;i++){const r=8+Math.random()*18;const a=Math.random()*Math.PI*2;const z=(Math.random()-.5)*18;positions.push(Math.cos(a)*r,Math.sin(a)*r,z)}starsGeo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));scene.add(new THREE.Points(starsGeo,new THREE.PointsMaterial({color:0x89cfe8,size:.018,transparent:true,opacity:.5})));
  const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();renderer.domElement.addEventListener('pointerdown',e=>{const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...nodeMeshes,...siteGroup.children]);const hit=hits[0];if(hit){if(siteGroup.children.includes(hit.object)){document.querySelector('.handoff').scrollIntoView({behavior:'smooth'});}else selectSupplier(hit.object.userData.supplierId)}});
  function resize(){const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h)}window.addEventListener('resize',resize);
  const clock=new THREE.Clock();function animate(){requestAnimationFrame(animate);const t=clock.getElapsedTime();if(!controls.state)globe.rotation.y+=.00035;wire.rotation.y=globe.rotation.y;scene.children.forEach(obj=>{if(obj.userData?.curve){const u=(t*.055+obj.userData.offset)%1;obj.position.copy(obj.userData.curve.getPoint(u))}});controls.update();renderer.render(scene,camera)}animate();
}


async function loadWorkflow(){
  try{const r=await fetch('/api/workflow');if(!r.ok)throw new Error();return await r.json();}
  catch{return {requisitions:dashboard.requisitions||[],receipts:dashboard.receipts||[],inspections:dashboard.inspections||[],releases:dashboard.material_releases||[],handoffs:dashboard.handoffs||[]};}
}
function badge(v){return `<span class="status ${statusClass(String(v))}">${v}</span>`}
function workflowSummary(type,rows){
  const risk=rows.filter(r=>['Critical','High','At Risk','Blocked','Hold','Quality Hold','Pending Approval'].includes(r.priority||r.status||r.disposition)).length;
  return `<div class="workflow-summary"><div><small>RECORDS</small><strong>${rows.length}</strong></div><div><small>NEEDS ACTION</small><strong>${risk}</strong></div><div><small>WORKFLOW</small><strong>${type.toUpperCase()}</strong></div><div><small>DATA SOURCE</small><strong>LIVE DB</strong></div></div>`
}
function renderWorkflow(type='requisitions'){
  document.querySelectorAll('.workflow-tab').forEach(b=>b.classList.toggle('active',b.dataset.workflow===type));
  const rows=workflowData[type]||[]; let head='',body='';
  if(type==='requisitions'){
    head='<tr><th>PR</th><th>Department</th><th>Material</th><th>Quantity</th><th>Needed By</th><th>Priority</th><th>Status</th><th>Action</th></tr>';
    body=rows.map(r=>`<tr><td>${r.pr_number}</td><td>${r.department}<small><br>${r.requester}</small></td><td>${r.material}</td><td>${Number(r.quantity).toLocaleString()} ${r.unit}</td><td>${r.needed_by}</td><td>${badge(r.priority)}</td><td>${badge(r.status)}</td><td><button class="action-btn" data-action="approve-pr" data-id="${r.id}" ${r.status==='Approved'?'disabled':''}>APPROVE</button></td></tr>`).join('');
  } else if(type==='receipts'){
    head='<tr><th>Receipt</th><th>PO</th><th>Material / Lot</th><th>Quantity</th><th>Received</th><th>Location</th><th>Status</th></tr>';
    body=rows.map(r=>`<tr><td>${r.receipt_number}</td><td>${r.po_number}</td><td>${r.material}<small><br>${r.lot_number}</small></td><td>${Number(r.quantity_received).toLocaleString()} ${r.unit}</td><td>${new Date(r.received_at).toLocaleString()}</td><td>${r.warehouse_location}</td><td>${badge(r.status)}</td></tr>`).join('');
  } else if(type==='inspections'){
    head='<tr><th>Inspection</th><th>Receipt</th><th>Sample</th><th>CoA</th><th>Identity</th><th>Visual</th><th>Disposition</th><th>Inspector</th><th>Action</th></tr>';
    body=rows.map(r=>`<tr><td>${r.inspection_number}</td><td>${r.receipt_id}</td><td>${r.sample_status}</td><td>${r.coa_verified?'Verified':'Mismatch'}</td><td>${r.identity_test}</td><td>${r.visual_result}</td><td>${badge(r.disposition)}</td><td>${r.inspector}</td><td><button class="action-btn" data-action="complete-inspection" data-id="${r.id}" ${r.disposition==='Approved'||r.disposition==='Hold'?'disabled':''}>COMPLETE</button></td></tr>`).join('');
  } else if(type==='releases'){
    head='<tr><th>Release</th><th>Receipt</th><th>Released Qty</th><th>Batch Allocation</th><th>Status</th><th>Released By</th><th>Action</th></tr>';
    body=rows.map(r=>`<tr><td>${r.release_number}</td><td>${r.receipt_id}</td><td>${Number(r.released_quantity).toLocaleString()} ${r.unit}</td><td>${r.batch_allocation}</td><td>${badge(r.status)}</td><td>${r.released_by}</td><td><button class="action-btn" data-action="release-material" data-id="${r.id}" ${r.status==='Released'||r.status==='Blocked'?'disabled':''}>RELEASE</button></td></tr>`).join('');
  } else {
    head='<tr><th>Handoff</th><th>Batch</th><th>Product</th><th>Scheduled Start</th><th>Readiness</th><th>Lots</th><th>Status</th><th>Constraint</th></tr>';
    body=rows.map(r=>`<tr><td>${r.handoff_number}</td><td>${r.batch_number}</td><td>${r.product}</td><td>${new Date(r.scheduled_start).toLocaleString()}</td><td><div class="handoff-readiness"><i style="width:${r.material_readiness_pct}%"></i></div><small>${r.material_readiness_pct}%</small></td><td>${r.released_lots}/${r.required_lots}</td><td>${badge(r.status)}</td><td>${r.constraint}</td></tr>`).join('');
  }
  $('#workflow-content').innerHTML=workflowSummary(type,rows)+`<table class="workflow-table"><thead>${head}</thead><tbody>${body}</tbody></table>`;
  document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>workflowAction(b.dataset.action,b.dataset.id,type)));
}
async function workflowAction(action,id,type){
  const paths={'approve-pr':`/api/requisitions/${id}/approve`,'complete-inspection':`/api/inspections/${id}/complete`,'release-material':`/api/releases/${id}/release`};
  try{const r=await fetch(paths[action],{method:'POST'});const result=await r.json();if(!r.ok)throw new Error(result.detail||'Workflow action failed');workflowData=await loadWorkflow();renderWorkflow(type)}catch(e){alert(e.message)}
}

function updateClock(){ $('#clock').textContent = new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}); }

async function init(){dashboard=await loadDashboard();renderDashboard(dashboard);createScene(dashboard);workflowData=await loadWorkflow();renderWorkflow();document.querySelectorAll('.workflow-tab').forEach(b=>b.addEventListener('click',()=>renderWorkflow(b.dataset.workflow)));updateClock();setInterval(updateClock,1000);document.querySelectorAll('[data-scenario]').forEach(b=>b.addEventListener('click',()=>simulate(b.dataset.scenario)));$('#refresh').addEventListener('click',async()=>{dashboard=await loadDashboard();renderDashboard(dashboard);});}
init();
