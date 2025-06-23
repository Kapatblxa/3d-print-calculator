const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  console.log('Function sendOrder started');

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const data = JSON.parse(event.body);
    console.log('Received data:', data);

    // Проверь переменные окружения
    const user = process.env.MAIL_USER;
    const pass = process.env.MAIL_PASS;
    console.log('Mail user:', user);

    if (!user || !pass) {
      console.error("MAIL_USER or MAIL_PASS not set in environment!");
      return { statusCode: 500, body: "Mail settings not configured." };
    }

    // Настрой транспорт
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass
      }
    });

    // Формируем письмо
    const message = {
      from: user,
      to: 'procrea.printing@gmail.com',
      subject: 'New 3D Print Order',
      text: `
Order Details:
Name: ${data.fullName}
NIF: ${data.nif}
Phone: ${data.phone}
Email: ${data.email}
Technology: ${data.technology}
Material: ${data.material}
Color: ${data.color}
Infill: ${data.infill}
Layer height: ${data.layer_height}
Quantity: ${data.quantity}
Volume: ${data.volume}
Weight: ${data.weight}
Print time: ${data.print_time}
Due date: ${data.due_date}
Unit price: ${data.unit_price}
Total price: ${data.total_price}
Comment: ${data.comment}
File: ${data.file_url}
      `,
    };

    // Пытаемся отправить
    const info = await transporter.sendMail(message);
    console.log('Email sent:', info.response);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Order sent successfully!" }),
    };
  } catch (error) {
    console.error('SendOrder error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to send order.", error: error.message }),
    };
  }
};
