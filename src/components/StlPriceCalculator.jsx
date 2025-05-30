import React, { useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, useProgress, Html, Bounds } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { MeshStandardMaterial, Vector3 } from 'three';
import dayjs from 'dayjs';
import { Widget } from '@uploadcare/react-widget';

// Pricing parameters
const MARKUP = 0.2;
const MATERIAL_COST = { PLA: 0.05, ABS: 0.07, PETG: 0.10 };
const TECHNOLOGY_COST = { FDM: 1.0, SLA: 5.0, SLS: 10.0 };
const MATERIAL_DENSITY = { PLA: 1.24, ABS: 1.04, PETG: 1.27 };
const PRINT_SPEED = { FDM: 15, SLA: 5, SLS: 10 };
const INFILL_OPTIONS = [10, 20, 30, 50, 70, 100];
const LAYER_HEIGHT_OPTIONS = [0.1, 0.15, 0.2, 0.3];

function Loader() {
  const { progress } = useProgress();
  return <Html center>{progress.toFixed(0)}% loading</Html>;
}

function Model({ url, color }) {
  const geometry = useLoader(STLLoader, url);
  const material = new MeshStandardMaterial({ color });
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  const center = new Vector3();
  geometry.boundingBox.getCenter(center);
  geometry.translate(-center.x, -center.y, -center.z);
  return <mesh geometry={geometry} material={material} />;
}

function calculateVolume(geometry) {
  if (!geometry?.attributes?.position) return 0;
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;
  const size = new Vector3();
  box.getSize(size);
  return (size.x / 10) * (size.y / 10) * (size.z / 10);
}

export default function StlPriceCalculator() {
  const [fileUrl, setFileUrl] = useState(null);
  const [fileUuid, setFileUuid] = useState(null);
  const [color, setColor] = useState('#cccccc');
  const [material, setMaterial] = useState('PLA');
  const [technology, setTechnology] = useState('FDM');
  const [infill, setInfill] = useState(20);
  const [layerHeight, setLayerHeight] = useState(0.2);
  const [quantity, setQuantity] = useState(1);
  const [comment, setComment] = useState('');

  const [volume, setVolume] = useState(0);
  const [weight, setWeight] = useState(0);
  const [printTime, setPrintTime] = useState(0);
  const [dueDate, setDueDate] = useState(null);
  const [unitPrice, setUnitPrice] = useState(0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!fileUrl) {
      setVolume(0);
      setWeight(0);
      setPrintTime(0);
      setDueDate(null);
      setUnitPrice(0);
      return;
    }
    const loader = new STLLoader();
    loader.load(
      fileUrl,
      (geometry) => {
        const fullVol = calculateVolume(geometry);
        const fullHours = fullVol / PRINT_SPEED[technology];
        const baseFull = fullVol * MATERIAL_COST[material] + TECHNOLOGY_COST[technology] * fullHours;
        const priceFull = baseFull * (1 + MARKUP);

        const infillVol = fullVol * (infill / 100);
        setVolume(infillVol);
        setWeight(infillVol * MATERIAL_DENSITY[material]);
        const hours = infillVol / PRINT_SPEED[technology];
        setPrintTime(hours);
        setDueDate(dayjs().add(Math.ceil(hours), 'hour').format('DD/MM/YYYY HH:mm'));

        const infillFactor = 0.8 + 0.2 * (infill / 100);
        const finalPrice = priceFull * infillFactor;
        setUnitPrice(Number(finalPrice).toFixed(2));
      },
      undefined,
      () => {
        setVolume(0);
        setWeight(0);
        setPrintTime(0);
        setDueDate(null);
        setUnitPrice(0);
      }
    );
  }, [fileUrl, material, technology, infill, layerHeight]);

  const handleOrder = async () => {
    if (!fileUuid) {
      alert('Please upload an STL file first.');
      return;
    }
    setSending(true);
    const totalPrice = (unitPrice * quantity).toFixed(2);

    const payload = {
      file_url: fileUrl,
      file_uuid: fileUuid,
      material,
      technology,
      infill: `${infill}%`,
      layer_height: `${layerHeight} mm`,
      color,
      quantity,
      volume: `${volume.toFixed(2)} cm³`,
      weight: `${(weight * quantity).toFixed(1)} g`,
      print_time: `${(printTime * quantity).toFixed(1)} h`,
      due_date: dueDate,
      unit_price: `€ ${unitPrice}`,
      total_price: `€ ${totalPrice}`,
      comment
    };

    try {
      const res = await fetch('https://your-server.com/api/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      alert(json.message || 'Order sent');
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">3D Print Cost & Order Form</h2>

      {/* Uploadcare Widget */}
      <Widget
  publicKey="8368b626f62009725d30"
  tabs="file url"
  clearable
  multiple={false}
  onUploadComplete={fileInfo => {
    setFileUrl(fileInfo.cdnUrl);
    setFileUuid(fileInfo.uuid);
  }}
/>

      {/* Preview and form after upload */}
      {fileUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="h-96 bg-gray-100">
            <Canvas>
              <ambientLight intensity={0.6} />
              <directionalLight position={[0, 10, 10]} intensity={1} />
              <React.Suspense fallback={<Loader />}>
                <Bounds fit clip margin={1.2}>
                  <Model url={fileUrl} color={color} />
                </Bounds>
              </React.Suspense>
              <OrbitControls makeDefault enablePan enableZoom />
            </Canvas>
          </div>

          <div className="space-y-4">
            {/* Parameters */}
            <div className="grid grid-cols-2 gap-4">
              {/* Material */}
              <div>
                <label>Material:</label>
                <select value={material} onChange={e => setMaterial(e.target.value)} className="w-full p-2 border rounded">
                  {Object.keys(MATERIAL_COST).map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              {/* Technology */}
              <div>
                <label>Technology:</label>
                <select value={technology} onChange={e => setTechnology(e.target.value)} className="w-full p-2 border rounded">
                  {Object.keys(TECHNOLOGY_COST).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {/* Infill */}
              <div>
                <label>Infill (%):</label>
                <select value={infill} onChange={e => setInfill(Number(e.target.value))} className="w-full p-2 border rounded">
                  {INFILL_OPTIONS.map(i => <option key={i} value={i}>{i}%</option>)}
                </select>
              </div>
              {/* Layer Height */}
              <div>
                <label>Layer Height (mm):</label>
                <select value={layerHeight} onChange={e => setLayerHeight(Number(e.target.value))} className="w-full p-2 border rounded">
                  {LAYER_HEIGHT_OPTIONS.map(lh => <option key={lh} value={lh}>{lh} mm</option>)}
                </select>
              </div>
            </div>

            {/* Color picker */}
            <div>
              <label>Color:</label>
              <input type="color" value={color} onChange={e => setColor(e.target.value)} className="w-16 h-10 border rounded" />
            </div>

            {/* Costs Details */}
            <div className="bg-white p-4 rounded shadow space-y-2">
              <h3 className="font-semibold">Print & Cost Details</h3>
              <p>Volume: {volume.toFixed(2)} cm³</p>
              <p>Weight: {weight.toFixed(1)} g</p>
              <p>Print Time: {printTime.toFixed(1)} h</p>
              {dueDate && <p>Estimated Completion: {dueDate}</p>}
              <p className="text-lg font-bold">Unit Price: € {unitPrice}</p>
            </div>

            {/* Quantity */}
            <div>
              <label>Quantity:</label>
              <input type="number" min="1" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="w-full p-2 border rounded" />
              <p className="text-sm text-gray-600 mt-1">If you order more than 3 items, expect a discount</p>
            </div>

            {/* Comments */}
            <div>
              <label>Comments:</label>
              <textarea value={comment} onChange={e => setComment(e.target.value)} className="w-full p-2 border rounded" rows={4} placeholder="Add any special instructions..." />
            </div>

            {/* Submit */}
            <button onClick={handleOrder} disabled={sending} className="mt-4 w-full bg-blue-600 text-white p-3 rounded shadow">
              {sending ? 'Sending Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
