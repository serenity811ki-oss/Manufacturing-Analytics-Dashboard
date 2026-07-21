FROM nginx:alpine
COPY . /usr/share/nginx/html:ro
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
