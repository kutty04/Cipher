# Use official Node.js image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files, Prisma schema, and Prisma 7 config
COPY backend/package*.json ./backend/
COPY backend/prisma.config.js ./backend/
COPY backend/prisma ./backend/prisma/

# Install dependencies in the backend directory
WORKDIR /app/backend
RUN npm ci

# Generate Prisma Client
RUN npx prisma generate

# Go back to /app and copy the remaining source code
WORKDIR /app
COPY backend/src ./backend/src

# Set working directory back to backend for running the app
WORKDIR /app/backend

# Expose the default Hugging Face Space port
EXPOSE 7860
ENV PORT=7860

# Start the application
CMD ["sh", "-c", "npx prisma db push && node src/server.js"]