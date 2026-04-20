import os
import re
from moviepy import (
    ImageClip, AudioFileClip, TextClip, CompositeVideoClip, concatenate_videoclips
)
import numpy as np

# 配置路径
BASE_DIR = r"D:\CloudMusic"
AUDIO_PATH = os.path.join(BASE_DIR, "作作精 - 许一世长安.mp3")
LRC_PATH = os.path.join(BASE_DIR, "作作精 - 许一世长安.lrc")
SCENE_MD_PATH = os.path.join(BASE_DIR, "场景.MD")
OUTPUT_PATH = os.path.join(BASE_DIR, "许一世长安_电影级.mp4")
FONT_PATH = r"C:\Windows\Fonts\msyh.ttc" # 微软雅黑

def parse_lrc(lrc_content):
    lyrics = []
    # [00:16.710]墨色晕染窗外一片竹林
    pattern = re.compile(r'\[(\d+):(\d+\.\d+)\](.*)')
    for line in lrc_content.split('\n'):
        match = pattern.match(line)
        if match:
            minutes = int(match.group(1))
            seconds = float(match.group(2))
            start_time = minutes * 60 + seconds
            text = match.group(3).strip()
            if text:
                lyrics.append({'start': start_time, 'text': text})
    
    # 设置每句歌词的结束时间
    for i in range(len(lyrics) - 1):
        lyrics[i]['end'] = lyrics[i+1]['start']
    if lyrics:
        lyrics[-1]['end'] = lyrics[-1]['start'] + 5 # 最后一句默认显示5秒
    return lyrics

def parse_scenes(md_content):
    scenes = []
    # Scene 1 (0:00-0:20)
    pattern = re.compile(r'Scene (\d+) \((\d+):(\d+)-(\d+):(\d+)\)')
    for line in md_content.split('\n'):
        match = pattern.search(line)
        if match:
            scene_num = int(match.group(1))
            start_m, start_s = int(match.group(2)), int(match.group(3))
            end_m, end_s = int(match.group(4)), int(match.group(5))
            start_time = start_m * 60 + start_s
            end_time = end_m * 60 + end_s
            scenes.append({
                'id': scene_num,
                'start': start_time,
                'end': end_time,
                'img': os.path.join(BASE_DIR, f"{scene_num}.jpg")
            })
    return scenes

def main():
    print("开始解析素材...")
    with open(LRC_PATH, 'r', encoding='utf-8') as f:
        lyrics = parse_lrc(f.read())
    
    with open(SCENE_MD_PATH, 'r', encoding='utf-8') as f:
        scenes = parse_scenes(f.read())
    
    audio = AudioFileClip(AUDIO_PATH)
    total_duration = audio.duration
    
    print(f"音频时长: {total_duration}s")
    
    # 如果场景时间超过音频时长，截断
    for scene in scenes:
        if scene['start'] > total_duration:
            scenes.remove(scene)
        elif scene['end'] > total_duration:
            scene['end'] = total_duration

    # 创建图片片段
    image_clips = []
    for scene in scenes:
        duration = scene['end'] - scene['start']
        if duration <= 0: continue
        
        # 电影级效果：稍微放大并平移 (Ken Burns effect)
        clip = ImageClip(scene['img']).with_duration(duration)
        clip = clip.resized(height=1080) # 统一高度到1080p
        
        # 添加渐入渐出效果
        clip = clip.with_start(scene['start'])
        image_clips.append(clip)

    # 创建背景视频（由图片组成）
    video = CompositeVideoClip(image_clips, size=(1920, 1080))
    
    # 创建字幕片段
    print("生成字幕...")
    subtitle_clips = []
    for l in lyrics:
        if l['start'] >= total_duration: continue
        dur = l['end'] - l['start']
        if dur <= 0: continue
        
        # 创建字幕文本
        txt = TextClip(
            text=l['text'],
            font=FONT_PATH,
            font_size=50,
            color='white',
            stroke_color='black',
            stroke_width=2,
            method='caption',
            size=(1800, 100)
        ).with_start(l['start']).with_duration(dur).with_position(('center', 900))
        
        subtitle_clips.append(txt)

    # 组合视频、字幕和音频
    final_video = CompositeVideoClip([video] + subtitle_clips)
    final_video = final_video.with_audio(audio)
    final_video = final_video.with_duration(total_duration)

    print(f"正在渲染视频到 {OUTPUT_PATH}...")
    # 使用 high quality 设置
    final_video.write_videofile(
        OUTPUT_PATH,
        fps=24,
        codec='libx264',
        audio_codec='aac',
        temp_audiofile='temp-audio.m4a',
        remove_temp=True,
        threads=4
    )
    print("视频渲染完成！")

if __name__ == "__main__":
    main()
