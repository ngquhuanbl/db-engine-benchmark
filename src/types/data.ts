export enum MessageSrc {
	UNKNOWN = -1,
	POLL = 1,
	SYNC_MOBILE_MESSAGE = 2,
	CLOUD = 3,
	LOCAL = 5,
	SYNC_MOBILE_DB = 7,
	GET_PREVIEW = 8,
	CLOUD_FIRST = 9,
	SOCKET = 10,
	MISS_MSG = 11,
	CLOUD_LOADER = 12,
}

export type MessageAction = 'leave' | 'remove_member' | 'add_member_summary';
export interface Data {
	msgId: string;
	cliMsgId: string;
	toUid?: string;
	msgType: number;
	sendDttm: string;
	isExpired?: boolean;
	isExpiredAll?: boolean;
	message:
		| string
		| {
				action: string;
				childnumber: number;
				description: string;
				hdUrl: string;
				normalUrl: string;
				oriUrl: string;
				params: string;
				thumbUrl: string;
				title: string;
				type: string;
		  };
	updateMemberIds?: Array<string>;
	act?: string;
	action: MessageAction;
	eventInfo?: {
		source?: object;
		updateMembers?: Array<any>;
		updateInfo?: object;
		errorMembers?: object;
		fromUid?: string;
		toUid?: string;
		role?: string;
		actType?: string;
		ts?: number;
	};
	zglobalMsgId?: string;
	src?: MessageSrc;
	actionId?: string;
	status?: number;
	notify?: string;
	mentions?: Array<object>;
	quote?: {
		quoteChatId?: string;
		attach?: string | object;
		ownerId?: string;
		ts: string;
		fromD?: string;
		cliMsgId: string;
		globalMsgId?: number;
		msg?: string;
		msgMedỉaRolled?: boolean;
		cliMsgType: number;
		msgMediaRolled?: boolean;
		ttl?: number;
		quoteStatus?: string;
		gOwnerId?: string;
		fromUid?: string;
		msgId?: string;
		textParams?: Array<any>;
		conversation?: object;
	};
	serverTime?: string;
	fromUid?: string;
	dName?: string;
	localDttm?: number;
	ttl?: number;
	st?: number;
	at?: number;
	cmd?: number;
	originMsgType?: string;
	subState?: number;
	e2eeStatus?: number;
	sequenseId?: number;
	isLocalMsgId?: boolean;
	properties?: {
		size?: number;
		ext?: string | object;
		type?: number;
		color?: number;
		subType?: number;
	};
	originTs?: string;
	subType?: number;
	localPath?: string;
	folderPath?: string;
	root?: number;
	syncFromMobile?: boolean;
	topOut?: string;
	topOutTimeOut?: string;
	topOutImprTimeOut?: string;
	previewThumb?: string;
	refMessageId?: string;
	urgency?: number;
	dimension?: {
		width: number;
		height: number;
		type: number;
		bigRes: boolean;
		orientation?: object;
	};
	extra?: { todoInfo: object };
	_friendRequestData?: { msg: string; src: number; userId: string };
	content?: string;
	isErrorInfo?: boolean;
	hasReact?: boolean;
	uidSenderDel?: string;
	footer?: {
		type: number;
		title: string;
		appId: number;
		clickType: number;
		params: null;
	};
	sendErrorCode?: number;
	__isUpdateMessage?: boolean;
	__updateData?: {
		clientVersion: number;
		idleUpdateInfo?: object;
		meta: object;
		name?: string;
		notes: string;
		notify: boolean;
		path?: string;
		sha2: string;
		updateType: number;
		url: string;
		version?: string;
		cachedPath?: string;
		clientOldVersion?: number;
		isModuleUpdate?: boolean;
		downloadedFile?: string;
	};
	width?: number;
	height?: number;
	zipKey?: string;
	resend?: {
		userId: string;
		conversationId: string;
		msgId: string;
		isGroup: boolean;
		clientId: number;
		type: number;
		content: object;
		subType?: number;
		subState?: number;
		_isGifPhoto?: boolean;
		e2eeStatus?: number;
	};
	cancelled?: boolean;
	z_parsedTokens?: Array<string | object>;
	isLastMsg?: boolean;
	isSelected?: boolean;
	textArguments?: Array<object>;
	msgText?: string;
	actionText?: string;
	platformType?: number;
	oldMsgId?: string;
	vOrient?: number;
	fileSize?: number;
	upSrc?: number;
	reader?: number;
	sequenceId?: number;
	staredDttm?: number;
}