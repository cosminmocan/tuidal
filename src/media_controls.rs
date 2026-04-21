use souvlaki::{
    MediaControlEvent, MediaControls, MediaMetadata, MediaPlayback, PlatformConfig,
};
use tokio::sync::mpsc::UnboundedSender;
use crate::app::{AppEvent, ApiCommand};

pub struct TuidalMediaControls {
    controls: MediaControls,
    last_title: String,
    last_artist: String,
    last_cover_url: Option<String>,
}

impl TuidalMediaControls {
    pub fn new(event_tx: UnboundedSender<AppEvent>) -> anyhow::Result<Self> {
        let config = PlatformConfig {
            dbus_name: "org.mpris.MediaPlayer2.tuidal",
            display_name: "Tuidal",
            hwnd: None,
        };

        let mut controls = MediaControls::new(config).map_err(|e| anyhow::anyhow!("{:?}", e))?;

        controls
            .attach(move |event| {
                let cmd = match event {
                    MediaControlEvent::Play | MediaControlEvent::Pause | MediaControlEvent::Toggle => {
                        Some(ApiCommand::PlayPause)
                    }
                    MediaControlEvent::Next => Some(ApiCommand::Next),
                    MediaControlEvent::Previous => Some(ApiCommand::Prev),
                    MediaControlEvent::Stop => Some(ApiCommand::PlayPause),
                    MediaControlEvent::SetPosition(pos) => Some(ApiCommand::SeekTo(pos.0.as_secs())),
                    _ => None,
                };

                if let Some(c) = cmd {
                    let _ = event_tx.send(AppEvent::ApiCmd(c));
                }
            })
            .map_err(|e| anyhow::anyhow!("{:?}", e))?;

        Ok(Self { 
            controls,
            last_title: String::new(),
            last_artist: String::new(),
            last_cover_url: None,
        })
    }

    pub fn update_metadata(&mut self, title: &str, artist: &str, album: &str, duration_secs: Option<f64>, cover_url: Option<&str>) {
        let url_str = cover_url.map(|s| s.to_string());
        if title == self.last_title && artist == self.last_artist && url_str == self.last_cover_url {
            return;
        }

        self.last_title = title.to_string();
        self.last_artist = artist.to_string();
        self.last_cover_url = url_str;

        let metadata = MediaMetadata {
            title: Some(title),
            artist: Some(artist),
            album: Some(album),
            duration: duration_secs.map(std::time::Duration::from_secs_f64),
            cover_url,
        };
        let _ = self.controls.set_metadata(metadata);
    }

    pub fn update_playback_status(&mut self, playing: bool, elapsed_secs: f64) {
        let status = if playing {
            MediaPlayback::Playing { 
                progress: Some(souvlaki::MediaPosition(std::time::Duration::from_secs_f64(elapsed_secs))) 
            }
        } else {
            MediaPlayback::Paused { 
                progress: Some(souvlaki::MediaPosition(std::time::Duration::from_secs_f64(elapsed_secs))) 
            }
        };
        
        // We always update status on macOS to keep the progress bar moving, 
        // but we can still cache the playing state to avoid some overhead.
        let _ = self.controls.set_playback(status);
    }
}
