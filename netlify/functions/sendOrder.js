const nodemailer = require('nodemailer');

exports.handler = async function(event, context) {
  // Получаем данные из запроса
  const data = JSON.parse(event.body);

  // Создаем transporter с помощью переменных окружения (MAIL_USER, MAIL_PASS)
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASS
    }
  });

  // Формируем письмо
  const mailOptions = {
    from: process.env.MAIL_USER,
    to: 'procrea.printing@gmail.com',
    subject: 'New 3D Print Order',
    html: `
      <h2>New 3D Print Order</h2>
      <ul>
        <li><b>Full Name:</b> ${data.fullName}</li>
        <li><b>NIF:</b> ${data.nif}</li>
        <li><b>Phone:</b> ${data.phone}</li>
        <li><b>Email:</b> ${data.email}</li>
        <li><b>Material:</b> ${data.material}</li>
        <li><b>Technology:</b> ${data.technology}</li>
        <li><b>Infill:</b> ${data.infill}</li>
        <li><b>Layer Height:</b> ${data.layer_height}</li>
        <li><b>Color:</b> ${data.color}</li>
        <li><b>Quantity:</b> ${data.quantity}</li>
        <li><b>Volume:</b> ${data.volume}</li>
        <li><b>Weight:</b> ${data.weight}</li>
        <li><b>Print Time:</b> ${data.print_time}</li>
        <li><b>Due Date:</b> ${data.due_date}</li>
        <li><b>Unit Price:</b> ${data.unit_price}</li>
        <li><b>Total Price:</b> ${data.total_price}</li>
        <li><b>Comment:</b> ${data.comment}</li>
        <li><b>File Link:</b> <a href="${data.file_url}">${data.file_url}</a></li>
      </ul>
    `,
  };

  // Пробуем отправить
  try {
    await transporter.sendMail(mailOptions);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Order sent successfully!" })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to send order.", error: err.message })
    };
  }
};
