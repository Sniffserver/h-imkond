import React, { useEffect, useRef, useState } from 'react';
import { Achievement, achievementService } from '../services/game/achievementService';
import { Award, Sparkles, X } from 'lucide-react';

interface AchievementCelebrationOverlayProps {
  achievement: Achievement | null;
  onClose: () => void;
  isNightMode?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
}

export const AchievementCelebrationOverlay: React.FC<AchievementCelebrationOverlayProps> = ({
  achievement,
  onClose,
  isNightMode = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (achievement) {
      setVisible(true);
      // Play retro-futuristic solarpunk golden chime
      achievementService.playChime();

      // Auto dismiss after 6 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 6000);

      return () => clearTimeout(timer);
    }
  }, [achievement]);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(onClose, 300); // Wait for transition fade out
  };

  // Sparkle particle engine
  useEffect(() => {
    if (!achievement || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let particles: Particle[] = [];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Warm solarpunk and gold gradient tones
    const colors = [
      '#E9C46A', // Gold
      '#F4A261', // Soft Amber
      '#E76F51', // Sunset Orange
      '#2A9D8F', // Forest Teal
      '#87A878', // Warm Sage
      '#FFF0D4', // Sparkle White
    ];

    // Seed particles
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2 - 40;

    for (let i = 0; i < 110; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 6.5 + 2.5;
      particles.push({
        x: centerX,
        y: centerY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - Math.random() * 2, // slightly upward gravity drift
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 5 + 2,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.008,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.15,
      });
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.08; // subtle gravity
        p.vx *= 0.98; // air friction
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) {
          particles.splice(idx, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        // Draw little diamonds or stars instead of generic circles
        ctx.beginPath();
        if (idx % 2 === 0) {
          // Diamond
          ctx.moveTo(0, -p.size * 1.4);
          ctx.lineTo(p.size, 0);
          ctx.lineTo(0, p.size * 1.4);
          ctx.lineTo(-p.size, 0);
        } else {
          // 4-pointed Star
          ctx.moveTo(0, -p.size * 1.6);
          ctx.quadraticCurveTo(0, 0, p.size * 1.6, 0);
          ctx.quadraticCurveTo(0, 0, 0, p.size * 1.6);
          ctx.quadraticCurveTo(0, 0, -p.size * 1.6, 0);
          ctx.quadraticCurveTo(0, 0, 0, -p.size * 1.6);
        }
        ctx.closePath();
        ctx.fill();

        // Optional glow
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        
        ctx.restore();
      });

      if (particles.length > 0) {
        animationId = requestAnimationFrame(animate);
      }
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resizeCanvas);
    };
  }, [achievement]);

  if (!achievement) return null;

  return (
    <div className={`fixed inset-0 z-100 flex items-center justify-center p-4 transition-all duration-300 ${
      visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
    }`}>
      {/* Dark backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={handleDismiss} />

      {/* Particle Canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none select-none z-10" />

      {/* Glowing achievement card */}
      <div
        className={`relative w-full max-w-sm rounded-[32px] border p-8 shadow-2xl text-center space-y-6 z-20 animate-in zoom-in-95 duration-300 ${
          isNightMode
            ? 'bg-[#182315] border-[#E9C46A]/40 text-[#F0F5EE] shadow-[#E9C46A]/10'
            : 'bg-[#FAF6EE] border-[#D6A23B]/40 text-[#203A2A] shadow-[#D6A23B]/10'
        }`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(214, 162, 59, 0.25)',
        }}
      >
        {/* Sparkle details */}
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#D6A23B] to-[#E9C46A] text-white px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-md flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-white animate-spin duration-1000" />
          Saavutus Unustatud!
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer text-[#588157]"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Big icon/badge visualization */}
        <div className="relative flex justify-center mt-3">
          <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-[#D6A23B]/20 to-[#E9C46A]/20 border-2 border-dashed border-[#D6A23B] flex items-center justify-center text-5xl relative animate-pulse">
            {achievement.icon}
            
            {/* Tiny stars or decoration around badge */}
            <div className="absolute -top-1 -right-1 text-base">✨</div>
            <div className="absolute -bottom-1 -left-1 text-base">🌟</div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-2">
          <h2 className="font-display font-black text-2xl tracking-tight text-gradient bg-gradient-to-r from-[#D6A23B] to-[#E9C46A] bg-clip-text text-transparent">
            {achievement.title}
          </h2>
          <p className="text-xs text-[#637062] dark:text-[#A8BDA5] leading-relaxed max-w-[280px] mx-auto">
            {achievement.description}
          </p>
        </div>

        {/* Milestone Indicator */}
        <div className="bg-[#FAF6EE] dark:bg-[#121A10] border border-[#87A878]/25 p-4 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between font-mono text-[11px] font-bold text-[#588157]">
            <span>Sihtmärk täidetud:</span>
            <span className="text-[#E76F51]">
              {achievement.targetValue} / {achievement.targetValue}
            </span>
          </div>
          <div className="w-full h-2.5 bg-black/5 dark:bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#D6A23B] to-[#E9C46A] rounded-full w-full" />
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="w-full py-3 bg-[#588157] hover:bg-[#476a46] text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-md shadow-[#588157]/25"
        >
          Sain kätte! ☀️
        </button>
      </div>
    </div>
  );
};
