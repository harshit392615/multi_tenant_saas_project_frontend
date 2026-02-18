const socket = new WebSocket(
  "ws://localhost:8000/ws/notes/1/"
);

socket.onmessage = function(event) {
  const data = JSON.parse(event.data);
  console.log(data.message);
};

socket.onclose = function() {
  console.log("WebSocket closed");
};
