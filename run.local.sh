export MONGO_URL=mongodb://localhost:27017/ventas-PROD
export MONGO_DB=ventas-PROD

export MAIL_URL='smtps://AKIAIAHTKCGZA3ISIO4Q:At7ZYqr1TFHJf374pEcCwO5q8otlV5M3rNPlv0qdQuem@email-smtp.us-east-1.amazonaws.com:465'
export NODE_OPTIONS="--max-old-space-size=4096"
meteor run --settings private/settings.local.server.json