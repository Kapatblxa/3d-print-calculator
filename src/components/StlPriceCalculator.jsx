import React, { useState, useEffect } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { OrbitControls, useProgress, Html, Bounds } from '@react-three/drei';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { MeshStandardMaterial, Vector3 } from 'three';
import dayjs from 'dayjs';
import { Widget } from '@uploadcare/react-widget';

const TECHNOLOGIES = ['FDM', 'SLA'];
const MATERIALS = {
  FDM: ['PLA', 'ABS', 'PETG'],
  SLA: ['ABS-like', 'Plant based', 'Translucent'],
};
const MATERIAL_DENSITY = {
  PLA: 1.24,
  ABS: 1.04,
  PETG: 1.27,
  'ABS-like': 1.10,
  'Plant based': 1.08,
  'Translucent': 1.13,
};
const PRINT_SPEED = { FDM: 15, SLA: 5 };
const INFILL_OPTIONS = [10, 20, 30, 50, 70, 100];
const LAYER_HEIGHT_OPTIONS = [0.1, 0.15, 0.2, 0.3];

// Финальные цены за грамм (с наценками)
const PRICE_PER_GRAM = {
  // FDM
  PLA: 0.09,   // Требование: 0.09 €/g (включая наценки)
  ABS: 0.04,
  PETG: 0.04,
  // SLA
  'Plant based': 1.05,
  'Translucent': 1.3125, // +25%
  'ABS-like': 1.1865,    // +13%
};

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
  // mm³ -> cm³ (грубая оценка: объём bounding box, умноженный на infill ниже)
  return (size.x / 10) * (size.y / 10) * (size.z / 10);
}

export default function StlPriceCalculator() {
  // Данные клиента
  const [fullName, setFullName] = useState('');
  const [nif, setNif] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Файл
  const [fileUrl, setFileUrl] = useState(null);
  const [fileUuid, setFileUuid] = useState(null);

  // Параметры печати
  const [color, setColor] = useState('#d6d6d6');
  const [technology, setTechnology] = useState('FDM');
  const [material, setMaterial] = useState('PLA');
  const [infill, setInfill] = useState(20);
  const [layerHeight, setLayerHeight] = useState(0.2);

  // Кол-во
  const [quantity, setQuantity] = useState(10); // по умолчанию 10

  // Комментарий
  const [comment, setComment] = useState('');

  // Расчётные величины
  const [volume, setVolume] = useState(0);
  const [weight, setWeight] = useState(0);
  const [printTime, setPrintTime] = useState(0);
  const [dueDate, setDueDate] = useState(null);
  const [unitPrice, setUnitPrice] = useState(0);

  const [sending, setSending] = useState(false);

  // при смене технологии — сбрасываем материал на первый из списка
  useEffect(() => {
    setMaterial(MATERIALS[technology][0]);
  }, [technology]);

  // перерасчёт метрик и цены
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
        const fullVol = calculateVolume(geometry); // cm³ (bounding box)
        const infillVol = fullVol * (infill / 100); // учёт заполнения
        const weightG = infillVol * MATERIAL_DENSITY[material]; // г (плотность ~ г/см³)

        setVolume(infillVol);
        setWeight(weightG);

        // Оценка времени печати
        const hours = infillVol / PRINT_SPEED[technology];
        setPrintTime(hours);
        setDueDate(dayjs().add(Math.ceil(hours), 'hour').format('DD/MM/YYYY HH:mm'));

        // Цена за единицу (без минималки)
        const baseUnit = (PRICE_PER_GRAM[material] || 1) * weightG;

        // Применяем условие минимальной цены:
        // - если quantity от 1 до 9 включительно — минимум €10/шт
        // - если quantity >= 10 — минимум НЕ применяется
        const qty = Number(quantity) || 0;
        const effectiveUnit = (qty >= 10) ? baseUnit : Math.max(baseUnit, 10);

        setUnitPrice(Number(effectiveUnit.toFixed(2)));
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
  }, [fileUrl, material, technology, infill, layerHeight, quantity]);

  const handleOrder = async () => {
    if (!fileUuid) {
      alert('Please upload an STL file first.');
      return;
    }
    setSending(true);

    const qty = Math.max(1, Number(quantity) || 1);
    const totalPrice = (unitPrice * qty).toFixed(2);

    const payload = {
      file_url: fileUrl,
      file_uuid: fileUuid,
      fullName,
      nif,
      phone,
      email,
      material,
      technology,
      infill: `${infill}%`,
      layer_height: `${layerHeight} mm`,
      color,
      quantity: qty,
      volume: `${volume.toFixed(2)} cm³`,
      weight: `${(weight * qty).toFixed(1)} g`,
      print_time: `${(printTime * qty).toFixed(1)} h`,
      due_date: dueDate,
      unit_price: `€ ${unitPrice.toFixed(2)}`,
      total_price: `€ ${totalPrice}`,
      comment,
    };

    try {
      const res = await fetch('/.netlify/functions/sendOrder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      alert(data.message || 'Order sent!');
    } catch (err) {
      alert('Error: ' + err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100" style={{ fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <div className="p-6 w-full max-w-5xl bg-white rounded shadow space-y-6">
        <h2 className="text-2xl font-bold text-center">3D Print Cost & Order Form</h2>

        <div className="flex flex-col items-center">
          <p className="text-sm mb-2" style={{ color: '#d6d6d6' }}>
            For files below 10 Mb
          </p>
          <Widget
            publicKey="8368b626f62009725d30"
            tabs="file url"
            imagesOnly={false}
            inputAcceptTypes=".stl"
            clearable
            multiple={false}
            onChange={(fileInfo) => {
              setFileUrl(fileInfo.cdnUrl);
              setFileUuid(fileInfo.uuid);
            }}
          />
        </div>

        {fileUrl && (
          <>
            {/* Контакты */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block font-medium">Full Name:</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Enter your name"
                  required
                />
              </div>
              <div>
                <label className="block font-medium">NIF Number:</label>
                <input
                  type="text"
                  value={nif}
                  onChange={e => setNif(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="NIF"
                  required
                />
              </div>
              <div>
                <label className="block font-medium">Phone:</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Phone"
                  required
                />
              </div>
              <div>
                <label className="block font-medium">Email:</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full p-2 border rounded"
                  placeholder="Email"
                  required
                />
              </div>
            </div>

            {/* Формы расчёта */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
              <div className="flex flex-col justify-between h-full">
                <div className="h-96 bg-gray-50 rounded overflow-hidden">
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
                <div className="flex-grow flex flex-col justify-end mt-4">
                  <label className="block font-medium">Comments:</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="w-full p-2 border rounded flex-grow"
                    placeholder="Add any special instructions..."
                  />
                </div>
              </div>

              <div className="space-y-4 flex flex-col h-full">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block font-medium">Technology:</label>
                    <select
                      value={technology}
                      onChange={e => setTechnology(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {TECHNOLOGIES.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium">Material:</label>
                    <select
                      value={material}
                      onChange={e => setMaterial(e.target.value)}
                      className="w-full p-2 border rounded"
                    >
                      {MATERIALS[technology].map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-medium">Infill (%):</label>
                  <select
                    value={infill}
                    onChange={e => setInfill(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                  >
                    {INFILL_OPTIONS.map(i => (
                      <option key={i} value={i}>{i}%</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium">Layer Height (mm):</label>
                  <select
                    value={layerHeight}
                    onChange={e => setLayerHeight(Number(e.target.value))}
                    className="w-full p-2 border rounded"
                  >
                    {LAYER_HEIGHT_OPTIONS.map(lh => (
                      <option key={lh} value={lh}>{lh} mm</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-medium">Color:</label>
                  <input
                    type="color"
                    value={color}
                    onChange={e => setColor(e.target.value)}
                    className="w-16 h-10 border rounded"
                  />
                </div>

                <div className="bg-white p-4 rounded shadow space-y-2">
                  <h3 className="font-semibold">Print & Cost Details</h3>
                  <p>Volume: {volume.toFixed(2)} cm³</p>
                  <p>Weight: {weight.toFixed(1)} g</p>
                  <p>Print Time: {printTime.toFixed(1)} h</p>
                  {dueDate && <p>Estimated Completion: {dueDate}</p>}
                  <p className="text-lg font-bold">Unit Price: € {unitPrice.toFixed(2)}</p>
                </div>

                <div>
                  <label className="block font-medium">Quantity:</label>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={quantity}
                    onChange={e => {
                      const v = Math.max(1, Number(e.target.value) || 1);
                      setQuantity(v);
                    }}
                    className="w-full p-2 border rounded"
                  />
                  <p className="text-sm text-gray-600 mt-1">
                    Orders of 1–9 items: minimum €10 per item. From 10+ items: no minimum price.
                  </p>
                </div>

                <button
                  onClick={handleOrder}
                  disabled={sending}
                  className="mt-4 w-full bg-blue-600 text-white p-3 rounded shadow"
                >
                  {sending ? 'Sending Order...' : 'Place Order'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
