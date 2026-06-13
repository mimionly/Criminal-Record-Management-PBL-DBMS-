# Step 1: Build the React Application
FROM node:18-alpine AS build

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Step 2: Serve compiled assets with Nginx
FROM nginx:alpine

# Copy built files
COPY --from=build /usr/src/app/dist /usr/share/nginx/html

# Copy custom Nginx configuration to support client-side routing & reverse proxy /api
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
