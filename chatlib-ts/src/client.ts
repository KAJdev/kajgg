import { Events } from "./constants";
import { TypedEmitter } from "./internal/typedEmitter";
import { Rest } from "./rest";
import { Gateway } from "./gateway";
import { EventType } from "./types";
import type {
  User,
  MessageCreated,
  MessageUpdated,
  MessageDeleted,
  ChannelCreated,
  ChannelUpdated,
  ChannelDeleted,
  AuthorUpdated,
  TypingStarted,
} from "./types";

type ReadyEvents = {
  [Events.ClientReady]: [Client<true>];
};

type KajEvents = ReadyEvents & {
  [EventType.MESSAGE_CREATED]: [MessageCreatedContext];
  [EventType.MESSAGE_UPDATED]: [MessageUpdatedContext];
  [EventType.MESSAGE_DELETED]: [MessageDeletedContext];
  [EventType.CHANNEL_CREATED]: [ChannelCreated];
  [EventType.CHANNEL_UPDATED]: [ChannelUpdated];
  [EventType.CHANNEL_DELETED]: [ChannelDeleted];
  [EventType.AUTHOR_UPDATED]: [AuthorUpdated];
  [EventType.TYPING_STARTED]: [TypingStarted];
};

export type ClientOptions = {
  baseUrl: string;
  gatewayUrl?: string;
};

export type LoginOptions =
  | string
  | {
      username: string;
      password: string;
    };

export class MessageCreatedContext {
  constructor(
    public client: Client<true>,
    public data: MessageCreated,
    public raw: any
  ) {}
  get message() {
    return this.data.message;
  }
  get author() {
    return this.data.author;
  }
  async send(content: string) {
    return await this.client.rest.sendMessage(
      this.data.message.channel_id,
      content
    );
  }
}

export class MessageUpdatedContext {
  constructor(
    public client: Client<true>,
    public data: MessageUpdated,
    public raw: any
  ) {}
}

export class MessageDeletedContext {
  constructor(
    public client: Client<true>,
    public data: MessageDeleted,
    public raw: any
  ) {}
}

export class Client<
  Ready extends boolean = boolean
> extends TypedEmitter<KajEvents> {
  public rest: Rest;
  public user: Ready extends true ? User : User | null = null as any;
  public token: string | null = null;

  private gateway: Gateway | null = null;
  private readyEmitted = false;

  constructor(opts: ClientOptions) {
    super();
    const baseUrl = opts.baseUrl.replace(/\/$/, "");
    const gatewayUrl = (opts.gatewayUrl ?? opts.baseUrl).replace(/\/$/, "");
    this.rest = new Rest({ baseUrl, token: null });

    // stash for later
    this._gatewayUrl = gatewayUrl;
  }

  private _gatewayUrl: string;

  async login(tokenOrCreds: LoginOptions): Promise<string> {
    if (typeof tokenOrCreds === "string") {
      this.token = tokenOrCreds;
    } else {
      const user = await this.rest.login(
        tokenOrCreds.username,
        tokenOrCreds.password
      );
      this.user = user as any;
      this.token = user.token ?? null;
    }

    if (!this.token) throw new Error("missing token after login");
    this.rest.setToken(this.token);

    // connect gateway and start emitting events
    await this.connectGateway();
    return this.token;
  }

  private async connectGateway(): Promise<void> {
    if (!this.token) throw new Error("missing token");
    if (this.gateway) this.gateway.close();

    this.gateway = new Gateway({
      gatewayUrl: this._gatewayUrl,
      token: this.token,
      onConnected: () => {
        if (!this.readyEmitted) {
          this.readyEmitted = true;
          // if user is still null (token login), we still consider "ready"
          this.emit(Events.ClientReady as any, this as any);
        }
      },
      onEvent: (evt) => this.handleGatewayEvent(evt),
    });

    // run in the background like discord.js does
    void this.gateway.runForever();
  }

  private handleGatewayEvent(evt: {
    t: string;
    d?: unknown;
    ts?: string | number;
  }) {
    // event payloads match typegen: {t: "...", d: {...}}
    switch (evt.t) {
      case EventType.MESSAGE_CREATED: {
        const data = evt.d as MessageCreated;
        this.emit(
          EventType.MESSAGE_CREATED as any,
          new MessageCreatedContext(this as any, data, evt)
        );
        return;
      }
      case EventType.MESSAGE_UPDATED: {
        const data = evt.d as MessageUpdated;
        this.emit(
          EventType.MESSAGE_UPDATED as any,
          new MessageUpdatedContext(this as any, data, evt)
        );
        return;
      }
      case EventType.MESSAGE_DELETED: {
        const data = evt.d as MessageDeleted;
        this.emit(
          EventType.MESSAGE_DELETED as any,
          new MessageDeletedContext(this as any, data, evt)
        );
        return;
      }
      case EventType.CHANNEL_CREATED:
      case EventType.CHANNEL_UPDATED:
      case EventType.CHANNEL_DELETED:
      case EventType.AUTHOR_UPDATED:
      case EventType.TYPING_STARTED:
        this.emit(evt.t as any, evt.d as any);
        return;
      default:
        return;
    }
  }

  destroy() {
    this.gateway?.close();
    this.gateway = null;
    this.token = null;
    this.rest.setToken(null);
  }
}
