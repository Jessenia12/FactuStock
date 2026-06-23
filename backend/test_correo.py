import smtplib
from email.mime.text import MIMEText
 
msg = MIMEText('Prueba de correo FactuStock - si recibes esto el correo funciona correctamente.')
msg['Subject'] = 'FactuStock - Prueba de correo'
msg['From'] = 'factustocknotificaciones@gmail.com'
msg['To'] = 'jesizambrano13@gmail.com'
 
try:
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as s:
        s.login('factustocknotificaciones@gmail.com', 'ryeofghgmoydgdvr')
        s.sendmail('factustocknotificaciones@gmail.com', 'jesizambrano13@gmail.com', msg.as_string())
        print('✅ Correo enviado correctamente')
except Exception as e:
    print(f'❌ Error: {e}')
 