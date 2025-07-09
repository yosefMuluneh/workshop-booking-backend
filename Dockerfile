# Use an official Node.js runtime as a parent image.
# Using a specific version like 18-alpine is good practice for stability and small size.
FROM node:18-alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker's layer caching.
# This means 'npm install' only runs when dependencies change, not on every code change.
COPY package*.json ./

# Install only production dependencies
RUN npm install --production

# Copy the Prisma schema to generate the client
COPY prisma ./prisma/

# Generate the Prisma Client. This is a crucial step for the container.
RUN npx prisma generate

# Copy the rest of the application's source code from your computer to the container
COPY . .

# Make your app's port available to the outside world
EXPOSE 5000

# Define the command to run your app
CMD [ "node", "index.js" ]