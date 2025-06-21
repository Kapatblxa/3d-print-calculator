const handleOrder = async () => {
  if (!fileUrl) {
    alert('Please upload an STL file first.');
    return;
  }
  setSending(true);

  const totalPrice = (unitPrice * quantity).toFixed(2);

  const payload = {
    fullName,
    nif,
    phone,
    email,
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
    comment,
    file_url: fileUrl
  };

  try {
    const res = await fetch('/.netlify/functions/sendOrder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    alert(json.message || 'Order sent!');
  } catch (err) {
    alert('Error: ' + err);
  } finally {
    setSending(false);
  }
};
