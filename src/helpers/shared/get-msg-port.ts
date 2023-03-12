import { AsyncContainer } from "./async-container";


const msgPortAsynContainer = new AsyncContainer<MessagePort>();

window.onmessage = (event) => {
	// event.source === window means the message is coming from the preload
	// script, as opposed to from an <iframe> or other source.
	if (event.source === window && event.data === 'msg-port') {
	  const [ port ] = event.ports
	  msgPortAsynContainer.resolve(port)
	}
  }

export async function getMsgPort(): Promise<MessagePort> {
	if (msgPortAsynContainer.value) return msgPortAsynContainer.value;
	return msgPortAsynContainer.promise;
}
