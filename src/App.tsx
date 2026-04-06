import React, { useState, useRef, ChangeEvent, useCallback } from 'react';
import { 
  Upload, 
  Download, 
  Sun , 
  Contrast, 
  Droplets, 
  Palette, 
  RotateCcw, 
  Image as ImageIcon,
  Maximize2,
  Minimize2,
  Layers,
  Settings2,
  Undo2,
  Redo2,
  RotateCw,
  Crop as CropIcon,
  History as HistoryIcon,
  Check,
  X,
  Edit3,
  ZoomIn,
  ZoomOut,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactCrop, { type Crop, type PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

interface Filters {
  exposure: number;
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  sepia: number;
  grayscale: number;
  blur: number;
  vignette: number;
  rotation: number;
}

const DEFAULT_FILTERS: Filters = {
  exposure: 100,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  hue: 0,
  sepia: 0,
  grayscale: 0,
  blur: 0,
  vignette: 0,
  rotation: 0,
};

interface HistoryState {
  image: string;
  filters: Filters;
  info: { width: number; height: number; name: string };
}

type Tab = 'adjust' | 'transform' | 'history';

const ASPECT_RATIOS = [
  { label: 'Tự do', value: undefined },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '3:4', value: 3 / 4 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '3:2', value: 3 / 2 },
  { label: '2:3', value: 2 / 3 },
];

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  const [activeTab, setActiveTab] = useState<Tab>('adjust');
  const [isZoomed, setIsZoomed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [imageInfo, setImageInfo] = useState<{ width: number; height: number; name: string } | null>(null);
  const [projectName, setProjectName] = useState<string>("Dự_án_chưa_đặt_tên");
  const [isEditingName, setIsEditingName] = useState(false);
  const [exportFormat, setExportFormat] = useState<'image/png' | 'image/jpeg' | 'image/webp'>('image/png');
  const [exportQuality, setExportQuality] = useState(0.9);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Crop State
  const [isCropMode, setIsCropMode] = useState(false);
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [cropZoom, setCropZoom] = useState(1);
  const [baseWidth, setBaseWidth] = useState(0);
  const imgRef = useRef<HTMLImageElement>(null);
  const cropContainerRef = useRef<HTMLDivElement>(null);
  const lastZoomRef = useRef(1);
  const mousePosRef = useRef({ x: 0, y: 0 });

  // Synchronize scroll position with zoom changes before browser paint
  React.useLayoutEffect(() => {
    const container = cropContainerRef.current;
    const img = imgRef.current;
    if (!container || !img || lastZoomRef.current === cropZoom) return;

    const zoomRatio = cropZoom / lastZoomRef.current;
    
    // Calculate how much the point under the mouse shifted relative to the image
    const dx = mousePosRef.current.x * (zoomRatio - 1);
    const dy = mousePosRef.current.y * (zoomRatio - 1);
    
    container.scrollLeft += dx;
    container.scrollTop += dy;
    
    lastZoomRef.current = cropZoom;
  }, [cropZoom]);

  React.useEffect(() => {
    const container = cropContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        
        // Exponential zoom for better performance and feel
        const zoomFactor = 1.15;
        const delta = e.deltaY > 0 ? 1 / zoomFactor : zoomFactor;
        const nextZoom = Math.min(8, Math.max(0.1, cropZoom * delta));
        
        if (nextZoom !== cropZoom) {
          const imgRect = imgRef.current?.getBoundingClientRect();
          if (imgRect) {
            // Store mouse position relative to the image itself
            mousePosRef.current = {
              x: e.clientX - imgRect.left,
              y: e.clientY - imgRect.top
            };
            setCropZoom(nextZoom);
          }
        }
      } else if (e.shiftKey) {
        // Horizontal scroll with Shift + scroll
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [isCropMode, cropZoom]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const addToHistory = (img: string, f: Filters, info: { width: number; height: number; name: string }) => {
    const newState: HistoryState = { image: img, filters: { ...f }, info: { ...info } };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    if (newHistory.length > 20) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setImage(prev.image);
      setFilters(prev.filters);
      setImageInfo(prev.info);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setImage(next.image);
      setFilters(next.filters);
      setImageInfo(next.info);
      setHistoryIndex(historyIndex + 1);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessing(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const info = {
            width: img.width,
            height: img.height,
            name: file.name
          };
          setProjectName(file.name);
          const dataUrl = event.target?.result as string;
          setImage(dataUrl);
          setOriginalImage(dataUrl);
          setImageInfo(info);
          setFilters(DEFAULT_FILTERS);
          
          const initialState: HistoryState = { image: dataUrl, filters: DEFAULT_FILTERS, info };
          setHistory([initialState]);
          setHistoryIndex(0);
          setIsProcessing(false);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFilterChange = (name: keyof Filters, value: number) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterChangeEnd = () => {
    if (image && imageInfo) {
      addToHistory(image, filters, imageInfo);
    }
  };

  const resetAll = () => {
    if (originalImage) {
      const img = new Image();
      img.onload = () => {
        const info = {
          width: img.width,
          height: img.height,
          name: imageInfo?.name || 'Ảnh gốc'
        };
        setImage(originalImage);
        setImageInfo(info);
        setFilters(DEFAULT_FILTERS);
        addToHistory(originalImage, DEFAULT_FILTERS, info);
      };
      img.src = originalImage;
    }
  };

  const restoreOriginalImage = () => {
    if (originalImage) {
      const img = new Image();
      img.onload = () => {
        const info = {
          width: img.width,
          height: img.height,
          name: imageInfo?.name || 'Ảnh gốc'
        };
        setImage(originalImage);
        setImageInfo(info);
        // Giữ nguyên filters hiện tại, chỉ khôi phục khung ảnh
        addToHistory(originalImage, filters, info);
      };
      img.src = originalImage;
    }
  };

  const onImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const container = cropContainerRef.current;
    const { naturalWidth, naturalHeight } = e.currentTarget;
    
    if (container) {
      // Calculate fit dimensions (100% of workspace)
      const availableWidth = container.clientWidth - 192; // md:p-24 is 96px each side
      const availableHeight = container.clientHeight - 192;
      // Multiply fit scale by 2.1 to make "100%" larger as requested
      const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight, 1) * 2.1;
      setBaseWidth(naturalWidth * scale);
    } else {
      setBaseWidth(naturalWidth);
    }
    
    let initialCrop;
    if (aspect) {
      const width = e.currentTarget.width;
      const height = e.currentTarget.height;
      initialCrop = centerCrop(
        makeAspectCrop(
          {
            unit: '%',
            width: 90,
          },
          aspect,
          width,
          height
        ),
        width,
        height
      );
    } else {
      initialCrop = {
        unit: '%',
        width: 90,
        height: 90,
        x: 5,
        y: 5
      };
    }
    setCrop(initialCrop);
  };

  const handleAspectChange = (newAspect: number | undefined) => {
    setAspect(newAspect);
    if (imgRef.current) {
      const { naturalWidth, naturalHeight } = imgRef.current;
      if (newAspect) {
        const newCrop = centerCrop(
          makeAspectCrop(
            {
              unit: '%',
              width: 90,
            },
            newAspect,
            naturalWidth,
            naturalHeight
          ),
          naturalWidth,
          naturalHeight
        );
        setCrop(newCrop);
      } else {
        // Free form
        setCrop({
          unit: '%',
          width: 90,
          height: 90,
          x: 5,
          y: 5
        });
      }
    }
  };

  const applyCrop = async () => {
    if (!image || !completedCrop || !imgRef.current || !imageInfo) return;
    setIsProcessing(true);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scaleX = imgRef.current.naturalWidth / imgRef.current.width;
    const scaleY = imgRef.current.naturalHeight / imgRef.current.height;

    canvas.width = completedCrop.width * scaleX;
    canvas.height = completedCrop.height * scaleY;

    ctx.drawImage(
      imgRef.current,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const croppedDataUrl = canvas.toDataURL('image/png');
    const newInfo = { ...imageInfo, width: Math.round(canvas.width), height: Math.round(canvas.height) };
    
    setImage(croppedDataUrl);
    setImageInfo(newInfo);
    addToHistory(croppedDataUrl, filters, newInfo);
    setIsCropMode(false);
    setCropZoom(1);
    setIsProcessing(false);
  };

  const downloadImage = async () => {
    if (!image || !canvasRef.current || !imageRef.current) return;

    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 800));

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;

    if (!ctx) return;

    // Handle rotation in dimensions
    const isVertical = filters.rotation % 180 !== 0;
    canvas.width = isVertical ? img.naturalHeight : img.naturalWidth;
    canvas.height = isVertical ? img.naturalWidth : img.naturalHeight;

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((filters.rotation * Math.PI) / 180);
    
    ctx.filter = `
      brightness(${filters.exposure}%)
      brightness(${filters.brightness}%)
      contrast(${filters.contrast}%)
      saturate(${filters.saturation}%)
      hue-rotate(${filters.hue}deg)
      sepia(${filters.sepia}%)
      grayscale(${filters.grayscale}%)
      blur(${filters.blur}px)
    `;

    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();

    // Apply Vignette
    if (filters.vignette > 0) {
      const gradient = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, 0,
        canvas.width / 2, canvas.height / 2, Math.sqrt(Math.pow(canvas.width / 2, 2) + Math.pow(canvas.height / 2, 2))
      );
      gradient.addColorStop(0, 'transparent');
      gradient.addColorStop(1, `rgba(0,0,0,${filters.vignette / 100})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const link = document.createElement('a');
    const extension = exportFormat.split('/')[1];
    link.download = `${projectName.split('.')[0]}_edited.${extension}`;
    link.href = canvas.toDataURL(exportFormat, exportQuality);
    link.click();
    setIsProcessing(false);
    setShowExportMenu(false);
  };

  const filterStyle = showOriginal ? {} : {
    filter: `
      brightness(${filters.exposure}%)
      brightness(${filters.brightness}%)
      contrast(${filters.contrast}%)
      saturate(${filters.saturation}%)
      hue-rotate(${filters.hue}deg)
      sepia(${filters.sepia}%)
      grayscale(${filters.grayscale}%)
      blur(${filters.blur}px)
    `,
    transform: `rotate(${filters.rotation}deg)`,
    transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
  };

  return (
    <div className="flex h-screen bg-[#050506] text-[#FAFAFA] overflow-hidden font-sans bg-atmosphere">
      {/* Left Sidebar */}
      <aside className="w-16 border-r border-white/5 flex flex-col items-center py-6 gap-8 bg-black/20 backdrop-blur-2xl z-30">
        <div className="group relative cursor-pointer">
          <motion.div 
            animate={{ 
              rotate: [0, 360],
              scale: [1, 1.1, 1]
            }}
            transition={{ 
              rotate: { duration: 20, repeat: Infinity, ease: "linear" },
              scale: { duration: 4, repeat: Infinity, ease: "easeInOut" }
            }}
            className="absolute -inset-3 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 blur-2xl opacity-30 group-hover:opacity-60 transition-opacity" 
          />
          <div className="w-10 h-10 relative flex items-center justify-center group">
            <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(168,85,247,0.6)]">
              <defs>
                <linearGradient id="logo-border" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
                <linearGradient id="camera-body" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#4C1D95" />
                </linearGradient>
                <linearGradient id="lens-grad" x1="100%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#FF71B6" />
                  <stop offset="50%" stopColor="#A855F7" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
                <linearGradient id="metallic-border" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFD1E8" />
                  <stop offset="20%" stopColor="#FF71B6" />
                  <stop offset="45%" stopColor="#FFFFFF" />
                  <stop offset="55%" stopColor="#A855F7" />
                  <stop offset="80%" stopColor="#4F46E5" />
                  <stop offset="100%" stopColor="#2D1B4E" />
                </linearGradient>
                <filter id="blur-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="5" />
                </filter>
              </defs>
              
              {/* Outer Frame */}
              <rect x="4" y="4" width="92" height="92" rx="28" fill="#050505" stroke="url(#logo-border)" strokeWidth="3.5" />
              
              {/* Blurred Camera Shadow behind the lens */}
              <path 
                d="M25 42C25 38 28 35 32 35H40L44 28H56L60 35H68C72 35 75 38 75 42V68C75 72 72 75 68 75H32C28 75 25 72 25 68V42Z" 
                fill="#A855F7" 
                filter="url(#blur-glow)"
                className="opacity-80"
              />

              {/* Camera Body */}
              <path 
                d="M25 42C25 38 28 35 32 35H40L44 28H56L60 35H68C72 35 75 38 75 42V68C75 72 72 75 68 75H32C28 75 25 72 25 68V42Z" 
                fill="url(#camera-body)" 
                className="opacity-90"
                stroke="rgba(255,255,255,0.2)"
                strokeWidth="0.8"
              />
              
              {/* Lens */}
              <circle cx="50" cy="55" r="19" stroke="rgba(168,85,247,0.3)" strokeWidth="4" fill="none" filter="url(#blur-glow)" />
              <circle cx="50" cy="55" r="15" fill="url(#lens-grad)" />
              <circle cx="50" cy="55" r="16.5" stroke="url(#metallic-border)" strokeWidth="3" fill="none" />
              
              {/* Small Flash/Sensor */}
              <circle cx="68" cy="44" r="2.2" fill="#111" opacity="0.8" />

              {/* Sparkles (4-pointed stars) */}
              <g transform="translate(65, 28) rotate(-10)">
                <path d="M0 -12 L2.5 -2.5 L12 0 L2.5 2.5 L0 12 L-2.5 2.5 L-12 0 L-2.5 -2.5 Z" fill="#FBCFE8" />
              </g>
              <g transform="translate(78, 42) rotate(-10) scale(0.5)">
                <path d="M0 -12 L2.5 -2.5 L12 0 L2.5 2.5 L0 12 L-2.5 2.5 L-12 0 L-2.5 -2.5 Z" fill="#FBCFE8" />
              </g>
            </svg>
          </div>
        </div>
        
        <nav className="flex flex-col gap-4">
          <ToolIcon icon={<ImageIcon size={20} />} active={activeTab === 'adjust'} onClick={() => setActiveTab('adjust')} />
          <ToolIcon icon={<Layers size={20} />} active={activeTab === 'transform'} onClick={() => setActiveTab('transform')} />
          <ToolIcon icon={<HistoryIcon size={20} />} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        </nav>

        <div className="mt-auto flex flex-col gap-4">
          <button 
            onMouseDown={() => setShowOriginal(true)}
            onMouseUp={() => setShowOriginal(false)}
            onMouseLeave={() => setShowOriginal(false)}
            disabled={!image}
            className={`p-3 rounded-xl transition-all ${showOriginal ? 'bg-purple-600 text-white' : 'text-[#52525B] hover:bg-[#141417]'} ${!image && 'opacity-20'}`}
            title="Nhấn giữ để xem ảnh gốc"
          >
            <Minimize2 size={20} />
          </button>
          <ToolIcon icon={<RotateCcw size={20} />} onClick={resetAll} disabled={!image} />
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-2xl z-20">
          <div className="flex items-center gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.2em] bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 font-black mb-0.5">Dự án</span>
              {isEditingName ? (
                <input
                  autoFocus
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onBlur={() => setIsEditingName(false)}
                  onKeyDown={(e) => e.key === 'Enter' && setIsEditingName(false)}
                  className="text-xs font-medium text-[#FAFAFA] bg-white/5 border border-purple-500/50 rounded px-1 outline-none w-[200px]"
                />
              ) : (
                <span 
                  onClick={() => setIsEditingName(true)}
                  className="text-xs font-medium text-[#FAFAFA] truncate max-w-[200px] cursor-pointer hover:text-purple-400 transition-colors flex items-center gap-2 group/name"
                >
                  {projectName}
                  <Edit3 size={10} className="opacity-0 group-hover/name:opacity-100 transition-opacity text-purple-400" />
                </span>
              )}
            </div>
            {image && (
              <>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-[#52525B] font-bold mb-0.5">Độ phân giải</span>
                  <span className="text-[10px] font-mono text-[#A1A1AA]">
                    {imageInfo?.width} × {imageInfo?.height} PX
                  </span>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/5">
                  <button 
                    onClick={undo} 
                    disabled={historyIndex <= 0}
                    className="p-1.5 text-[#52525B] hover:text-white hover:bg-white/5 rounded-md disabled:opacity-20 transition-all"
                  >
                    <Undo2 size={14} />
                  </button>
                  <button 
                    onClick={redo} 
                    disabled={historyIndex >= history.length - 1}
                    className="p-1.5 text-[#52525B] hover:text-white hover:bg-white/5 rounded-md disabled:opacity-20 transition-all"
                  >
                    <Redo2 size={14} />
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!image ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold rounded-full transition-all active:scale-95 shadow-lg shadow-purple-900/40 border border-white/10"
              >
                <Upload size={14} />
                NHẬP ẢNH
              </button>
            ) : (
              <>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-[#A1A1AA] hover:text-white hover:bg-white/5 rounded-full transition-all border border-transparent hover:border-white/10"
                  title="Thay đổi ảnh"
                >
                  <Upload size={16} />
                </button>
                
                <div className="relative">
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white text-xs font-black rounded-full transition-all active:scale-95 disabled:opacity-50 shadow-xl shadow-purple-900/20 border border-white/10"
                  >
                    {isProcessing ? (
                      <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                    XUẤT FILE
                  </button>

                  <AnimatePresence>
                    {showExportMenu && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-3 w-64 bg-[#141417] border border-[#27272A] rounded-2xl shadow-2xl p-4 z-50 backdrop-blur-xl"
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-[#52525B]">Cấu hình xuất file</h4>
                            <button onClick={() => setShowExportMenu(false)} className="text-[#52525B] hover:text-white">
                              <X size={14} />
                            </button>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[9px] font-bold uppercase tracking-wider text-[#71717A]">Định dạng</label>
                            <div className="grid grid-cols-3 gap-2">
                              {(['image/png', 'image/jpeg', 'image/webp'] as const).map((fmt) => (
                                <button
                                  key={fmt}
                                  onClick={() => setExportFormat(fmt)}
                                  className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-all border ${
                                    exportFormat === fmt 
                                      ? 'bg-purple-600/10 border-purple-500 text-purple-500' 
                                      : 'bg-white/5 border-white/5 text-[#52525B] hover:text-[#A1A1AA]'
                                  }`}
                                >
                                  {fmt.split('/')[1]}
                                </button>
                              ))}
                            </div>
                          </div>

                          {(exportFormat === 'image/jpeg' || exportFormat === 'image/webp') && (
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <label className="text-[9px] font-bold uppercase tracking-wider text-[#71717A]">Chất lượng</label>
                                <span className="text-[10px] font-mono font-bold text-purple-500">{Math.round(exportQuality * 100)}%</span>
                              </div>
                              <input
                                type="range"
                                min="0.1"
                                max="1"
                                step="0.05"
                                value={exportQuality}
                                onChange={(e) => setExportQuality(parseFloat(e.target.value))}
                                className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-purple-500"
                              />
                            </div>
                          )}

                          <button
                            onClick={downloadImage}
                            className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:opacity-90 transition-all shadow-lg shadow-purple-900/20"
                          >
                            Tải xuống ngay
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </header>

        <div className="flex-1 relative bg-[#020203] flex items-center justify-center p-12 overflow-hidden">
          <div className="absolute inset-0 opacity-[0.02] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
          
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />

          <AnimatePresence mode="wait">
            {!image ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="text-center space-y-6 z-10"
              >
                <div className="w-24 h-24 mx-auto bg-[#141417] border border-[#27272A] rounded-[2rem] flex items-center justify-center text-[#3F3F46]">
                  <ImageIcon size={48} strokeWidth={1.5} />
                </div>
                <div className="space-y-2">
                  <h2 className="text-2xl font-bold tracking-tight">Studio Chuyên Nghiệp</h2>
                  <p className="text-[#A1A1AA] max-w-xs mx-auto text-sm leading-relaxed">
                    Tải ảnh lên để bắt đầu quy trình hậu kỳ với các thông số kỹ thuật cao.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-8 py-3 bg-[#1C1C21] border border-[#27272A] hover:border-purple-500/50 hover:bg-purple-500/5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                >
                  Chọn tệp từ thiết bị
                </button>
              </motion.div>
            ) : isCropMode ? (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 z-[100] bg-[#050506] flex flex-col"
              >
                {/* Crop Header */}
                <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-black/40 backdrop-blur-xl">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-600/20 rounded-lg text-purple-500">
                      <CropIcon size={18} />
                    </div>
                    <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">Công cụ cắt ảnh</h3>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 bg-white/5 px-4 py-1.5 rounded-full border border-white/10">
                      <button 
                        onClick={() => setCropZoom(Math.max(0.1, cropZoom - 0.05))}
                        className="text-[#A1A1AA] hover:text-white transition-colors"
                      >
                        <ZoomOut size={14} />
                      </button>
                      <input 
                        type="range"
                        min="0.1"
                        max="8"
                        step="0.01"
                        value={cropZoom}
                        onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                        className="w-24 h-1 bg-white/10 rounded-full appearance-none cursor-pointer accent-purple-500"
                      />
                      <button 
                        onClick={() => setCropZoom(Math.min(8, cropZoom + 0.05))}
                        className="text-[#A1A1AA] hover:text-white transition-colors"
                      >
                        <ZoomIn size={14} />
                      </button>
                      <span className="text-[10px] font-mono text-purple-500 font-bold min-w-[30px] text-right">
                        {Math.round(cropZoom * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setIsCropMode(false);
                        setCropZoom(1);
                      }}
                      className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all"
                    >
                      Hủy bỏ
                    </button>
                    <button 
                      onClick={applyCrop}
                      disabled={!completedCrop?.width || !completedCrop?.height}
                      className="px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-purple-900/40 transition-all disabled:opacity-50"
                    >
                      Xác nhận
                    </button>
                  </div>
                </div>

                {/* Crop Area */}
                <div className="flex-1 relative overflow-hidden bg-[#020203]">
                  <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                       style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
                  
                  <div 
                    ref={cropContainerRef}
                    className="w-full h-full overflow-auto custom-scrollbar flex p-12 md:p-24"
                  >
                    <div className="relative inline-block shadow-[0_0_100px_rgba(0,0,0,0.5)] m-auto">
                      <ReactCrop
                        crop={crop}
                        onChange={(c) => setCrop(c)}
                        onComplete={(c) => setCompletedCrop(c)}
                        aspect={aspect}
                        ruleOfThirds
                        minWidth={10}
                        minHeight={10}
                      >
                        <img
                          ref={imgRef}
                          src={image}
                          alt="Nguồn cắt"
                          onLoad={onImageLoad}
                          className="block"
                          style={{ 
                            filter: filterStyle.filter,
                            width: baseWidth ? `${baseWidth * cropZoom}px` : 'auto',
                            height: 'auto',
                            maxWidth: 'none',
                            maxHeight: 'none',
                            willChange: 'width, height',
                          }}
                        />
                      </ReactCrop>
                    </div>
                  </div>
                </div>

                {/* Crop Footer */}
                <div className="p-1.5 pb-3 bg-black/80 backdrop-blur-2xl border-t border-white/5 flex flex-col items-center gap-1">
                  <div className="flex flex-wrap justify-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
                    {ASPECT_RATIOS.map((ratio) => (
                      <button
                        key={ratio.label}
                        onClick={() => handleAspectChange(ratio.value)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold uppercase transition-all ${
                          aspect === ratio.value 
                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-900/20' 
                            : 'text-[#A1A1AA] hover:text-white hover:bg-white/5'
                        }`}
                      >
                        {ratio.label}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex flex-col items-center gap-0.5">
                    <p className="text-[8px] text-[#52525B] font-medium flex items-center gap-2">
                      <Search size={10} />
                      Giữ <span className="text-purple-500 font-bold">Ctrl</span> + Cuộn chuột để phóng to tại vị trí trỏ chuột • Giữ <span className="text-purple-500 font-bold">Shift</span> + Cuộn chuột để di chuyển ngang
                    </p>
                    <p className="text-[7px] text-[#3F3F46] font-medium italic">
                      Kéo các góc để điều chỉnh vùng cắt • Ảnh luôn ở cỡ 100% khi bắt đầu
                    </p>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`relative group transition-all duration-500 ease-out ${isZoomed ? 'scale-110' : 'scale-100'}`}
              >
                <div className="absolute -inset-4 bg-purple-600/10 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                
                <div className="relative overflow-hidden rounded-sm shadow-2xl shadow-black/50">
                  <img
                    ref={imageRef}
                    src={image}
                    alt="Vùng làm việc"
                    className="max-w-full max-h-[70vh] object-contain"
                    style={filterStyle}
                    referrerPolicy="no-referrer"
                  />
                  
                  {!showOriginal && filters.vignette > 0 && (
                    <div 
                      className="absolute inset-0 pointer-events-none transition-opacity duration-300"
                      style={{
                        background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${filters.vignette / 100}) 100%)`
                      }}
                    />
                  )}
                </div>
                
                <div className="absolute top-4 left-4 px-3 py-1.5 bg-black/40 backdrop-blur-md rounded-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-white/60">
                    {showOriginal ? "Ảnh gốc" : "Ảnh đã chỉnh sửa"}
                  </span>
                </div>

                <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => setIsZoomed(!isZoomed)}
                    className="p-2 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 hover:bg-black/80 transition-colors"
                  >
                    {isZoomed ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {isProcessing && (
            <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] z-50 flex items-center justify-center">
              <div className="bg-[#141417] border border-[#27272A] px-6 py-4 rounded-2xl flex items-center gap-4 shadow-2xl">
                <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium">Đang xử lý dữ liệu...</span>
              </div>
            </div>
          )}
        </div>

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
      </main>

      {/* Right Sidebar */}
      <aside className="w-80 border-l border-white/5 bg-black/40 backdrop-blur-2xl flex flex-col z-30">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
            {activeTab === 'adjust' ? 'Điều chỉnh' : activeTab === 'transform' ? 'Biến đổi' : 'Lịch sử'}
          </h3>
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse-glow" />
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-10 custom-scrollbar pb-24">
          {!image ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
              <Settings2 size={32} strokeWidth={1} />
              <p className="text-xs leading-relaxed">Tải ảnh lên để kích hoạt<br/>bảng điều khiển chuyên sâu</p>
            </div>
          ) : activeTab === 'adjust' ? (
            <>
              <ControlGroup label="Ánh sáng & Phơi sáng" icon={<Sun size={14} className="text-orange-400" />}>
                <Slider label="Độ phơi sáng" value={filters.exposure} min={0} max={200} onChange={(v) => handleFilterChange('exposure', v)} onEnd={handleFilterChangeEnd} suffix="%" />
                <Slider label="Độ sáng" value={filters.brightness} min={0} max={200} onChange={(v) => handleFilterChange('brightness', v)} onEnd={handleFilterChangeEnd} suffix="%" />
                <Slider label="Độ tương phản" value={filters.contrast} min={0} max={200} onChange={(v) => handleFilterChange('contrast', v)} onEnd={handleFilterChangeEnd} suffix="%" />
              </ControlGroup>

              <ControlGroup label="Màu sắc & Sắc thái" icon={<Droplets size={14} className="text-indigo-400" />}>
                <Slider label="Độ bão hòa" value={filters.saturation} min={0} max={200} onChange={(v) => handleFilterChange('saturation', v)} onEnd={handleFilterChangeEnd} suffix="%" />
                <Slider label="Sắc độ (Hue)" value={filters.hue} min={0} max={360} onChange={(v) => handleFilterChange('hue', v)} onEnd={handleFilterChangeEnd} suffix="°" />
                <Slider label="Hoài cổ (Sepia)" value={filters.sepia} min={0} max={100} onChange={(v) => handleFilterChange('sepia', v)} onEnd={handleFilterChangeEnd} suffix="%" />
                <Slider label="Đen trắng" value={filters.grayscale} min={0} max={100} onChange={(v) => handleFilterChange('grayscale', v)} onEnd={handleFilterChangeEnd} suffix="%" />
              </ControlGroup>

              <ControlGroup label="Hiệu ứng & Chi tiết" icon={<Layers size={14} className="text-pink-400" />}>
                <Slider label="Độ mờ (Blur)" value={filters.blur} min={0} max={20} onChange={(v) => handleFilterChange('blur', v)} onEnd={handleFilterChangeEnd} suffix="px" />
                <Slider label="Làm tối góc" value={filters.vignette} min={0} max={100} onChange={(v) => handleFilterChange('vignette', v)} onEnd={handleFilterChangeEnd} suffix="%" />
              </ControlGroup>
            </>
          ) : activeTab === 'transform' ? (
            <div className="space-y-8">
              <div className="space-y-4">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#52525B]">Xoay ảnh</h4>
                <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      const newRotation = (filters.rotation - 90) % 360;
                      handleFilterChange('rotation', newRotation);
                      handleFilterChangeEnd();
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-[#141417] border border-[#27272A] rounded-xl hover:bg-[#1C1C21] transition-all"
                  >
                    <RotateCcw size={16} />
                    <span className="text-xs font-medium">-90°</span>
                  </button>
                  <button 
                    onClick={() => {
                      const newRotation = (filters.rotation + 90) % 360;
                      handleFilterChange('rotation', newRotation);
                      handleFilterChangeEnd();
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-[#141417] border border-[#27272A] rounded-xl hover:bg-[#1C1C21] transition-all"
                  >
                    <RotateCw size={16} />
                    <span className="text-xs font-medium">+90°</span>
                  </button>
                </div>
              </div>

              <div className="space-y-4 pt-8 border-t border-[#27272A]">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#52525B]">Cắt ảnh</h4>
                <button 
                  onClick={() => {
                    setIsCropMode(true);
                    setCropZoom(1);
                  }}
                  className="w-full flex items-center justify-center gap-3 py-4 bg-purple-600/10 border border-purple-500/30 text-purple-500 rounded-xl hover:bg-purple-600/20 transition-all font-bold"
                >
                  <CropIcon size={20} />
                  Mở công cụ cắt ảnh
                </button>
                
                <button 
                  onClick={restoreOriginalImage}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-[#141417] border border-[#27272A] text-[#A1A1AA] rounded-xl hover:bg-[#1C1C21] transition-all text-xs font-semibold"
                >
                  <RotateCcw size={16} />
                  Khôi phục khung ảnh gốc
                </button>

                <p className="text-[10px] text-[#52525B] leading-relaxed text-center">
                  Sử dụng công cụ cắt để thay đổi kích thước hoặc khôi phục lại trạng thái ban đầu của ảnh.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((h, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setImage(h.image);
                    setFilters(h.filters);
                    setImageInfo(h.info);
                    setHistoryIndex(i);
                  }}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex items-center gap-4 ${
                    i === historyIndex 
                      ? 'bg-purple-600/10 border-purple-500' 
                      : 'bg-[#141417] border-[#27272A] hover:border-[#3F3F46]'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-black border border-white/10 flex-shrink-0">
                    <img src={h.image} className="w-full h-full object-cover" alt={`Step ${i}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold truncate ${i === historyIndex ? 'text-purple-500' : 'text-[#FAFAFA]'}`}>
                      {i === 0 ? 'Ảnh gốc' : `Bước chỉnh sửa ${i}`}
                    </p>
                    <p className="text-[10px] text-[#52525B] truncate">
                      {h.info.width} × {h.info.height} PX
                    </p>
                  </div>
                  {i === historyIndex && <Check size={14} className="text-purple-500" />}
                </button>
              ))}
              {history.length > 1 && (
                <button 
                  onClick={() => {
                    if (history.length > 0) {
                      const first = history[0];
                      setHistory([first]);
                      setHistoryIndex(0);
                      setImage(first.image);
                      setFilters(first.filters);
                      setImageInfo(first.info);
                    }
                  }}
                  className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-red-500/60 hover:text-red-500 transition-colors"
                >
                  Xóa toàn bộ lịch sử
                </button>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-white/5 bg-black/60 backdrop-blur-xl">
          <div className="flex items-center justify-between text-[9px] font-mono tracking-widest text-[#52525B]">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-orange-500' : 'bg-green-500'}`} />
              <span>BPE_HỆ_THỐNG_V3.0</span>
            </div>
            <span className={isProcessing ? "text-orange-500" : "text-green-500"}>{isProcessing ? "ĐANG XỬ LÝ" : "SẴN SÀNG"}</span>
          </div>
        </div>
      </aside>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

function ToolIcon({ icon, active = false, onClick, disabled = false }: { icon: React.ReactNode, active?: boolean, onClick?: () => void, disabled?: boolean }) {
  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`p-3 rounded-xl transition-all duration-300 relative group ${
        active 
          ? 'text-purple-500' 
          : 'text-[#52525B] hover:text-[#A1A1AA]'
      } ${disabled ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {active && (
        <motion.div 
          layoutId="activeTab"
          className="absolute inset-0 bg-purple-600/10 rounded-xl border border-purple-500/20 shadow-[0_0_20px_rgba(139,92,246,0.1)]"
        />
      )}
      <div className="relative z-10">{icon}</div>
    </button>
  );
}

function ControlGroup({ label, icon, children }: { label: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="space-y-6 relative">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 shadow-inner">
          {icon}
        </div>
        <h4 className="text-[9px] font-black uppercase tracking-[0.25em] text-[#52525B]">{label}</h4>
      </div>
      <div className="space-y-6 pl-1 border-l border-white/[0.03] ml-3">
        {children}
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, onChange, onEnd, suffix = "" }: { label: string, value: number, min: number, max: number, onChange: (v: number) => void, onEnd?: () => void, suffix?: string }) {
  return (
    <div className="space-y-3 group">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-bold text-[#71717A] group-hover:text-[#A1A1AA] transition-colors tracking-wide uppercase">{label}</label>
        <div className="px-2 py-0.5 rounded bg-purple-600/10 border border-purple-500/20">
          <span className="text-[10px] font-mono font-bold text-purple-500">{value}{suffix}</span>
        </div>
      </div>
      <div className="relative flex items-center">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value))}
          onMouseUp={onEnd}
          onTouchEnd={onEnd}
          className="w-full h-1 bg-white/5 rounded-full appearance-none cursor-pointer accent-purple-500"
        />
      </div>
    </div>
  );
}

function PresetBox({ label, active = false, onClick }: { label: string, active?: boolean, onClick?: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`aspect-square rounded-lg border flex items-center justify-center text-[10px] font-bold uppercase transition-all ${
        active 
          ? 'bg-purple-600 border-purple-500 text-white' 
          : 'bg-[#141417] border-[#27272A] text-[#52525B] hover:border-[#3F3F46] hover:text-[#A1A1AA]'
      }`}
    >
      {label}
    </button>
  );
}
