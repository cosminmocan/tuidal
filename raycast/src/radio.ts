import { showToast, Toast } from "@raycast/api";
import { api } from "./api";

export default async function Command() {
  try {
    await api.startRadio();
    await showToast({
      style: Toast.Style.Success,
      title: "📻 Starting Radio",
      message: "Contextual radio loaded into queue",
    });
  } catch (error) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Tuidal not running",
      message: String(error),
    });
  }
}
