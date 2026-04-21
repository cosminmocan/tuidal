import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Icon,
  showToast,
  Toast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import { api, formatDuration, progressBar } from "./api";
import type { Status } from "./types";

export default function NowPlaying() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  async function refresh() {
    try {
      setStatus(await api.status());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 3000);
    return () => clearInterval(id);
  }, []);

  async function cmd(fn: () => Promise<void>) {
    try {
      await fn();
      setTimeout(refresh, 300);
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Tuidal not running",
      });
    }
  }

  const markdown = buildMarkdown(status, error);

  return (
    <Detail
      isLoading={loading}
      markdown={markdown}
      metadata={
        status?.title ? (
          <Detail.Metadata>
            <Detail.Metadata.Label
              title="Status"
              text={status.state}
              icon={
                status.state === "playing"
                  ? { source: Icon.Play, tintColor: Color.Green }
                  : status.state === "paused"
                    ? { source: Icon.Pause, tintColor: Color.Yellow }
                    : { source: Icon.Stop, tintColor: Color.SecondaryText }
              }
            />
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label title="Volume" text={`${status.volume}%`} />
            <Detail.Metadata.Label
              title="Time"
              text={`${formatDuration(status.elapsed)} / ${status.duration ? formatDuration(status.duration) : "?:??"}`}
            />
            <Detail.Metadata.Label
              title="Shuffle"
              text={status.shuffle ? "On" : "Off"}
              icon={status.shuffle ? Icon.Shuffle : undefined}
            />
            <Detail.Metadata.Label title="Repeat" text={status.repeat} />
            {status.codec && (
              <Detail.Metadata.Label
                title="Quality"
                text={`${status.bit_depth}bit / ${(status.sample_rate ?? 0) / 1000}kHz ${status.codec.toUpperCase()}`}
              />
            )}
            <Detail.Metadata.Separator />
            <Detail.Metadata.Label
              title="Queue"
              text={
                status.queue.length
                  ? `${(status.queue_index ?? 0) + 1} / ${status.queue.length}`
                  : "—"
              }
            />
          </Detail.Metadata>
        ) : undefined
      }
      actions={
        <ActionPanel>
          <ActionPanel.Section title="Playback">
            <Action
              title={status?.state === "playing" ? "Pause" : "Play"}
              icon={status?.state === "playing" ? Icon.Pause : Icon.Play}
              onAction={() => cmd(api.playPause)}
            />
            <Action
              title="Next Track"
              icon={Icon.Forward}
              onAction={() => cmd(api.next)}
              shortcut={{ modifiers: [], key: "arrowRight" }}
            />
            <Action
              title="Previous Track"
              icon={Icon.Rewind}
              onAction={() => cmd(api.previous)}
              shortcut={{ modifiers: [], key: "arrowLeft" }}
            />
            <Action
              title="Start Radio"
              icon={Icon.Speaker}
              onAction={() => cmd(() => api.startRadio())}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel.Section>
          <ActionPanel.Section title="Modes">
            <Action
              title="Toggle Shuffle"
              icon={Icon.Shuffle}
              onAction={() => cmd(api.shuffle)}
            />
            <Action
              title="Cycle Repeat"
              icon={Icon.Repeat}
              onAction={() => cmd(api.repeat)}
            />
          </ActionPanel.Section>
          <ActionPanel.Section>
            <Action
              title="Refresh"
              icon={Icon.ArrowClockwise}
              onAction={refresh}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

function buildMarkdown(status: Status | null, error: boolean): string {
  if (error) return "## ⚠️ Tuidal not running\n\nStart the app and try again.";
  if (!status || status.state === "stopped" || !status.title)
    return "## Nothing playing\n\nOpen Tuidal and start a track.";

  const parts = [];

  if (status.cover_url) {
    // Large centered image using Markdown
    parts.push(`<img src="${status.cover_url}" alt="${status.album}" width="400" />`);
    parts.push("");
  }

  parts.push(`# ${status.title}`);
  parts.push(`### ${status.artist}`);
  parts.push(`*${status.album}*`);

  return parts.join("\n");
}
