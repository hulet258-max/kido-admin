import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { adminApi, type AdminConfig } from './api';
import type { Activity, ActivityType, Video } from './types';

const categories = ['animals', 'science', 'education', 'drawing', 'stories', 'sports', 'ethiopia', 'language', 'music', 'religious', 'nature', 'entertainment'];

function initialConfig(): AdminConfig {
  return {
    apiUrl: localStorage.getItem('kido-admin-api') || import.meta.env.VITE_API_URL || 'http://localhost:4001/api',
    adminKey: localStorage.getItem('kido-admin-key') || 'kido-local-admin',
  };
}

export default function App() {
  const [config, setConfig] = useState(initialConfig);
  const [draftConfig, setDraftConfig] = useState(initialConfig);
  const [view, setView] = useState<'videos' | 'activities'>('videos');
  const [videos, setVideos] = useState<Video[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [nextVideos, nextActivities] = await Promise.all([
        adminApi.videos(config),
        adminApi.activities(config),
      ]);
      setVideos(nextVideos);
      setActivities(nextActivities);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load content');
    } finally {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => { void refresh(); }, [refresh]);

  function saveConnection(event: FormEvent) {
    event.preventDefault();
    localStorage.setItem('kido-admin-api', draftConfig.apiUrl);
    localStorage.setItem('kido-admin-key', draftConfig.adminKey);
    setConfig(draftConfig);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span>K</span><div><strong>KIDO</strong><small>Content Studio</small></div></div>
        <nav>
          <button className={view === 'videos' ? 'active' : ''} onClick={() => setView('videos')}><i>▶</i> Videos</button>
          <button className={view === 'activities' ? 'active' : ''} onClick={() => setView('activities')}><i>?</i> Activities</button>
        </nav>
        <form className="connection" onSubmit={saveConnection}>
          <label>Backend URL<input value={draftConfig.apiUrl} onChange={(event) => setDraftConfig({ ...draftConfig, apiUrl: event.target.value })} /></label>
          <label>Admin key<input type="password" value={draftConfig.adminKey} onChange={(event) => setDraftConfig({ ...draftConfig, adminKey: event.target.value })} /></label>
          <button className="secondary" type="submit">Save connection</button>
        </form>
      </aside>

      <main>
        <header>
          <div><p className="eyebrow">CONTENT CONTROL</p><h1>{view === 'videos' ? 'Video library' : 'Learning activities'}</h1></div>
          <button className="icon-button" onClick={() => void refresh()} aria-label="Refresh">↻</button>
        </header>
        {error && <div className="alert">{error}</div>}
        {view === 'videos' ? (
          <VideoWorkspace config={config} videos={videos} loading={loading} onChanged={refresh} />
        ) : (
          <ActivityWorkspace config={config} activities={activities} loading={loading} onChanged={refresh} />
        )}
      </main>
    </div>
  );
}

function videoFilesFromList(list: FileList | null) {
  return Array.from(list || [])
    .filter((file) => /\.(mp4|mov|m4v)$/i.test(file.name))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
}

function sharedVideoFields(form: FormData) {
  return {
    description: String(form.get('description') || ''),
    category: String(form.get('category') || ''),
    language: String(form.get('language') || 'en'),
    minAge: Number(form.get('minAge')),
    maxAge: Number(form.get('maxAge')),
    creator: String(form.get('creator') || ''),
    tags: String(form.get('tags') || ''),
    thumbnailUrl: String(form.get('thumbnailUrl') || ''),
    isShort: form.get('isShort') === 'true',
    isEducational: form.get('isEducational') === 'true',
    isReligious: form.get('isReligious') === 'true',
  };
}

function copySharedVideoFields(target: FormData, source: FormData, title: string) {
  target.append('title', title);
  const shared = sharedVideoFields(source);
  target.append('description', shared.description);
  target.append('category', shared.category);
  target.append('language', shared.language);
  target.append('minAge', String(shared.minAge));
  target.append('maxAge', String(shared.maxAge));
  target.append('creator', shared.creator);
  target.append('tags', shared.tags);
  if (shared.thumbnailUrl) target.append('thumbnailUrl', shared.thumbnailUrl);
  if (shared.isShort) target.append('isShort', 'true');
  if (shared.isEducational) target.append('isEducational', 'true');
  if (shared.isReligious) target.append('isReligious', 'true');
}

function VideoWorkspace({ config, videos, loading, onChanged }: { config: AdminConfig; videos: Video[]; loading: boolean; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<'single' | 'folder'>('single');
  const [progress, setProgress] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [folderFileCount, setFolderFileCount] = useState(0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError('');
    const form = new FormData(formElement);
    const title = String(form.get('title') || '').trim();
    try {
      if (mode === 'folder') {
        const folder = String(form.get('folder') || '').trim();
        const files = videoFilesFromList((formElement.elements.namedItem('folderFiles') as HTMLInputElement | null)?.files ?? null);
        if (!folder && files.length === 0) {
          setError('Choose a folder of videos or enter a folder path on the backend server.');
          return;
        }
        if (folder) {
          setStatus('Reading the folder and publishing every video…');
          setProgress(0);
          const result = await adminApi.importFolder(config, { folder, title, ...sharedVideoFields(form) });
          const failedNote = result.failed.length ? ` ${result.failed.length} failed.` : '';
          setStatus(`Published ${result.published.length} of ${result.total} videos as “${title} 1” … “${title} ${result.published.length}”.${failedNote}`);
          if (result.failed.length) {
            setError(result.failed.map((item) => `${item.file}: ${item.error}`).join(' · '));
          }
        } else {
          setProgress(0);
          for (let index = 0; index < files.length; index += 1) {
            const numbered = `${title} ${index + 1}`;
            setStatus(`Uploading ${index + 1} of ${files.length}: ${numbered}`);
            const payload = new FormData();
            payload.append('video', files[index]);
            copySharedVideoFields(payload, form, numbered);
            await adminApi.uploadVideo(config, payload, (value) => {
              setProgress((index + value) / files.length);
              if (value >= 1) setStatus(`Segmenting ${numbered}…`);
            });
          }
          setStatus(`Published ${files.length} videos as “${title} 1” … “${title} ${files.length}”.`);
        }
      } else {
        setStatus('Uploading video…');
        setProgress(0);
        await adminApi.uploadVideo(config, form, (value) => {
          setProgress(value);
          if (value >= 1) setStatus('Segmenting and storing in MinIO…');
        });
        setStatus('Video published successfully.');
      }
      formElement.reset();
      setFolderFileCount(0);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed');
      setStatus('');
    } finally {
      setProgress(null);
    }
  }

  async function remove(video: Video) {
    if (!window.confirm(`Delete “${video.title}” and its HLS files?`)) return;
    try {
      await adminApi.removeVideo(config, video.id);
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Delete failed');
    }
  }

  return (
    <div className="workspace">
      <section className="panel form-panel">
        <div className="panel-heading"><div className="panel-icon coral">＋</div><div><h2>{mode === 'folder' ? 'Upload a folder of videos' : 'Upload a video'}</h2><p>{mode === 'folder' ? 'Every file in the folder gets the same description and settings, named with an incrementing title.' : 'One quality, segmented into 4-second HLS files.'}</p></div></div>
        <form className="content-form" onSubmit={submit}>
          <div className="mode-toggle" role="tablist">
            <button type="button" className={mode === 'single' ? 'active' : ''} onClick={() => setMode('single')}>One video</button>
            <button type="button" className={mode === 'folder' ? 'active' : ''} onClick={() => setMode('folder')}>Folder of videos</button>
          </div>
          {mode === 'single' ? (
            <label className="file-drop"><input name="video" type="file" accept="video/mp4,video/quicktime,video/x-m4v" required /><strong>Choose MP4, MOV, or M4V</strong><span>The source is removed after processing · maximum 500 MB</span></label>
          ) : (
            <>
              <label className="file-drop">
                <input
                  name="folderFiles"
                  type="file"
                  accept="video/mp4,video/quicktime,video/x-m4v"
                  multiple
                  {...{ webkitdirectory: '', directory: '' }}
                  onChange={(event) => setFolderFileCount(videoFilesFromList(event.target.files).length)}
                />
                <strong>{folderFileCount > 0 ? `${folderFileCount} videos selected` : 'Choose a folder of MP4, MOV, or M4V files'}</strong>
                <span>Files are uploaded in name order as Title 1, Title 2, Title 3…</span>
              </label>
              <label>Server folder path<input name="folder" placeholder="C:\videos\space  or  /data/videos/space" /><span className="field-hint">If this is filled, the backend reads that folder on the server instead of uploading from this browser.</span></label>
            </>
          )}
          <div className="two"><label>{mode === 'folder' ? 'Title prefix' : 'Title'}<input name="title" required minLength={2} placeholder={mode === 'folder' ? 'Space Adventure' : ''} /></label><label>Creator<input name="creator" required /></label></div>
          {mode === 'folder' && <p className="field-hint">Videos are named “Prefix 1”, “Prefix 2”, and so on. The description and settings below are applied to every file.</p>}
          <label>Description<textarea name="description" rows={3} required /></label>
          <div className="three"><label>Category<select name="category">{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label>Language<select name="language"><option value="en">English</option><option value="am">Amharic</option><option value="om">Oromo</option><option value="ti">Tigrinya</option><option value="so">Somali</option></select></label><label>Thumbnail URL<input name="thumbnailUrl" type="url" placeholder="Optional" /></label></div>
          <div className="three"><label>Minimum age<input name="minAge" type="number" min="3" max="15" defaultValue="3" required /></label><label>Maximum age<input name="maxAge" type="number" min="3" max="15" defaultValue="12" required /></label><label>Tags<input name="tags" placeholder="space, science, stars" required /></label></div>
          <div className="checks"><label><input name="isShort" type="checkbox" value="true" /> Short video</label><label><input name="isEducational" type="checkbox" value="true" /> Educational</label><label><input name="isReligious" type="checkbox" value="true" /> Religious</label></div>
          {progress != null && <div className="progress"><span style={{ width: `${Math.max(3, progress * 100)}%` }} /></div>}
          {status && <p className="success-text">{status}</p>}{error && <p className="error-text">{error}</p>}
          <button className="primary" disabled={progress != null}>{progress != null ? 'Processing…' : mode === 'folder' ? 'Upload folder and publish' : 'Upload and publish'}</button>
        </form>
      </section>

      <section className="panel library-panel">
        <div className="panel-heading"><div><h2>Published videos</h2><p>{videos.length} videos in the catalog</p></div></div>
        {loading ? <Empty message="Loading videos…" /> : videos.length === 0 ? <Empty message="No videos have been published." /> : (
          <div className="content-list">{videos.map((video) => (
            <article className="video-row" key={video.id}>
              <div className="poster">{video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <span>▶</span>}</div>
              <div className="row-copy"><strong>{video.title}</strong><span>{video.category} · ages {video.minAge}–{video.maxAge} · {formatDuration(video.durationSeconds)}</span><div className="tags">{video.tags.slice(0, 4).map((tag) => <em key={tag}>{tag}</em>)}</div></div>
              <a className="round-link" href={video.videoUrl} target="_blank" rel="noreferrer" title="Open HLS playlist">↗</a>
              <button className="danger-icon" onClick={() => void remove(video)} title="Delete video">×</button>
            </article>
          ))}</div>
        )}
      </section>
    </div>
  );
}

function ActivityWorkspace({ config, activities, loading, onChanged }: { config: AdminConfig; activities: Activity[]; loading: boolean; onChanged: () => Promise<void> }) {
  const [type, setType] = useState<ActivityType>('quiz');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const counts = useMemo(() => Object.fromEntries(['quiz', 'order', 'match'].map((kind) => [kind, activities.filter((item) => item.type === kind).length])), [activities]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setSaving(true); setError('');
    const data = new FormData(formElement);
    const lines = (name: string) => String(data.get(name) || '').split('\n').map((value) => value.trim()).filter(Boolean);
    const options = String(data.get('options') || '').split(',').map((value) => value.trim()).filter(Boolean);
    const pairs = Object.fromEntries(lines('pairs').map((line) => line.split('=').map((value) => value.trim())).filter((pair) => pair.length === 2 && pair[0] && pair[1]));
    const payload: Omit<Activity, 'id'> = {
      category: String(data.get('category')),
      minAge: Number(data.get('minAge')),
      maxAge: Number(data.get('maxAge')),
      type,
      prompt: String(data.get('prompt')),
      successFeedback: String(data.get('successFeedback')),
      retryFeedback: String(data.get('retryFeedback')),
      ...(type === 'quiz' ? { options, correctAnswer: String(data.get('correctAnswer')) } : {}),
      ...(type === 'order' ? { items: lines('items'), correctOrder: lines('correctOrder') } : {}),
      ...(type === 'match' ? { pairs } : {}),
    };
    try {
      await adminApi.createActivity(config, payload);
      formElement.reset();
      setType('quiz');
      await onChanged();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save activity');
    } finally { setSaving(false); }
  }

  async function remove(activity: Activity) {
    if (!window.confirm('Delete this activity?')) return;
    try { await adminApi.removeActivity(config, activity.id); await onChanged(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Delete failed'); }
  }

  return (
    <div className="workspace">
      <section className="panel form-panel">
        <div className="panel-heading"><div className="panel-icon sky">?</div><div><h2>Create an activity</h2><p>Reviewed prompts shown at the middle of matching videos.</p></div></div>
        <form className="content-form" onSubmit={submit}>
          <div className="three"><label>Type<select value={type} onChange={(event) => setType(event.target.value as ActivityType)}><option value="quiz">Quiz</option><option value="order">Put in order</option><option value="match">Match pairs</option></select></label><label>Category<select name="category">{categories.map((value) => <option key={value}>{value}</option>)}</select></label><span className="mini-stats">{counts[type] || 0}<small> existing</small></span></div>
          <div className="two"><label>Minimum age<input name="minAge" type="number" min="3" max="15" defaultValue="3" required /></label><label>Maximum age<input name="maxAge" type="number" min="3" max="15" defaultValue="12" required /></label></div>
          <label>Prompt<textarea name="prompt" rows={2} required /></label>
          {type === 'quiz' && <><label>Answer options<input name="options" placeholder="Mercury, Earth, Jupiter" required /></label><label>Correct answer<input name="correctAnswer" placeholder="Must exactly match an option" required /></label></>}
          {type === 'order' && <div className="two"><label>Shuffled items<textarea name="items" rows={4} placeholder={'Finish\nStart\nKeep going'} required /></label><label>Correct order<textarea name="correctOrder" rows={4} placeholder={'Start\nKeep going\nFinish'} required /></label></div>}
          {type === 'match' && <label>Pairs<textarea name="pairs" rows={5} placeholder={'One = 1\nTwo = 2\nThree = 3'} required /></label>}
          <div className="two"><label>Success feedback<input name="successFeedback" defaultValue="Great job!" required /></label><label>Retry feedback<input name="retryFeedback" defaultValue="Almost! Try again." required /></label></div>
          {error && <p className="error-text">{error}</p>}
          <button className="primary" disabled={saving}>{saving ? 'Saving…' : 'Publish activity'}</button>
        </form>
      </section>
      <section className="panel library-panel">
        <div className="panel-heading"><div><h2>Activity catalog</h2><p>{activities.length} reviewed activities</p></div></div>
        {loading ? <Empty message="Loading activities…" /> : activities.length === 0 ? <Empty message="No activities have been created." /> : (
          <div className="content-list">{activities.map((activity) => (
            <article className="activity-row" key={activity.id}><span className={`type-badge ${activity.type}`}>{activity.type === 'quiz' ? '?' : activity.type === 'order' ? '↕' : '↔'}</span><div className="row-copy"><strong>{activity.prompt}</strong><span>{activity.type} · {activity.category} · ages {activity.minAge}–{activity.maxAge}</span></div><button className="danger-icon" onClick={() => void remove(activity)}>×</button></article>
          ))}</div>
        )}
      </section>
    </div>
  );
}

function Empty({ message }: { message: string }) { return <div className="empty"><span>◇</span><p>{message}</p></div>; }
function formatDuration(seconds: number) { return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`; }
