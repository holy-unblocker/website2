import { db, dbEnabled } from "@config/apis";
import { appConfig } from "@config/config";
import TheatreWrapper from "./TheatreWrapper";
import TheatreAPI from "./TheatreAPI";

export { dbEnabled };

// extra wrappers for theatre stuff

export const theatreAPI: TheatreWrapper = dbEnabled
  ? new TheatreWrapper(db)
  : (undefined as any);

export const theatreAPIMirror: TheatreAPI = dbEnabled
  ? (undefined as any)
  : new TheatreAPI(appConfig.theatreApiMirror);
