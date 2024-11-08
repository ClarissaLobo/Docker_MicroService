# Use an official Node.js runtime as a base image
FROM node:16

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy the package.json and package-lock.json (if available)
# This allows Docker to install dependencies before copying the entire app
COPY package*.json ./

# Copy the swagger.yaml file into the container
COPY swagger.yaml ./

# Install the dependencies specified in package.json
RUN npm install

# Copy the rest of the application files to the container
COPY . .

# # # Add wait-for-it.sh to the container
COPY wait-for-it.sh /usr/src/app/wait-for-it.sh
RUN chmod +x /usr/src/app/wait-for-it.sh

# Expose the port your app will run on
EXPOSE 5000

# Command to run the application after ensuring PostgreSQL is ready
CMD ["./wait-for-it.sh", "postgres:5432", "--", "node", "frontend.js"]
# CMD [ "node", "frontend.js"]
