# ---- Build stage ----
FROM golang:1.23-alpine AS builder

WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download

COPY . .
# CGO disabled — modernc/sqlite is pure Go, no C compiler needed
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

# ---- Runtime stage ----
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app
COPY --from=builder /app/server .

# Data directory — mount a volume here in production
VOLUME ["/app/data"]

EXPOSE 8080

ENV DATA_DIR=/app/data \
    PORT=8080

ENTRYPOINT ["./server"]
