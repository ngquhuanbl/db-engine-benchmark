import { SQLiteSocket } from "../helpers/renderer/web-socket/library";

const socket = SQLiteSocket.getInstance();
socket.configure();
