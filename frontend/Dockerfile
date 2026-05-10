FROM nginx:alpine
RUN apk add --no-cache openssl
RUN mkdir -p /etc/nginx/certs \
  && openssl req -x509 -nodes -newkey rsa:2048 -days 3650 \
     -keyout /etc/nginx/certs/selfsigned.key \
     -out /etc/nginx/certs/selfsigned.crt \
     -subj "/C=RU/ST=Moscow/L=Moscow/O=RTU MIREA/OU=CHISTOVIK/CN=localhost"
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
COPY ./frontend /usr/share/nginx/html