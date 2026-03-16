FROM node:22-alpine

WORKDIR /app

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

COPY package*.json ./
RUN npm ci

COPY . ./

RUN npx prisma generate
RUN npm run build

CMD ["npm", "run", "start:prod"]
