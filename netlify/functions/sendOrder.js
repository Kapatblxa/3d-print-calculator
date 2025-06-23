const nodemailer = require('nodemailer');

exports.handler = async (event, context) => {
  try {
    // Получаем данные заказа из тела запроса
    const orderData = JSON.parse(event.body);

    // Формируем номер заказа: YYYY_MM_DD_HHMM (например, 2024_06_23_2243)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const orderNumber = `${year}_${month}_${day}_${hour}${minute}`;

    // Добавим номер заказа в orderData
    orderData.orderNumber = orderNumber;

    // Формируем текст письма
    const messageLines = [
      `Order number: ${orderNumber}`,
      '',
      `Full Name: ${orderData.fullName}`,
      `NIF: ${orderData.nif}`,
      `Phone: ${orderData.phone}`,
      `Email: ${orderData.email}`,
      `Technology: ${orderData.technology}`,
      `Material: ${orderData.material}`,
      `Infill: ${orderData.infill}`,
      `Layer Height: ${orderData.layer_height}`,
      `Color: ${orderData.color}`,
      `Quantity: ${orderData.quantity}`,
      `Volume: ${orderData.volume}`,
      `Weight: ${orderData.weight}`,
      `Print Time: ${orderData.print_time}`,
      `Due Date: ${orderData.due_date}`,
      `Unit Price: ${orderData.unit_price}`,
      `Total Price: ${orderData.total_price}`,
      `Comments: ${orderData.comment}`,
      `File URL: ${orderData.file_url}`,
    ];

    const messageText = messageLines.join('\n');

    // Настройка транспорта Nodemailer
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    // Отправка письма
    await transporter.sendMail({
      from: process.env.MAIL_USER,
      to: 'procrea.printing@gmail.com',
      subject: `3D Print Order #${orderNumber}`,
      text: messageText,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `Order #${orderNumber} sent!` }),
    };
  } catch (error) {
    console.error('SendOrder error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to send order.' }),
    };
  }
};
