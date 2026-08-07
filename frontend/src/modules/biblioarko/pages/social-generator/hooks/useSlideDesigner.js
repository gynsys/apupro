import { useState, useEffect } from 'react';
import { DEFAULT_DESIGN } from '../lib/constants';
import { blogService } from '../../../services/blogService';
import { toast } from 'react-hot-toast';

const TEMPLATE_STORAGE_KEY = 'arko360_carousel_templates';

export const useSlideDesigner = () => {
  // ... existing state definitions ...
  const [bgColor, setBgColor] = useState(DEFAULT_DESIGN.bgColor);
  const [bgColor2, setBgColor2] = useState(DEFAULT_DESIGN.bgColor2);
  const [bgColor3, setBgColor3] = useState(DEFAULT_DESIGN.bgColor3);
  const [useBgGradient, setUseBgGradient] = useState(DEFAULT_DESIGN.useBgGradient);
  const [fontSize, setFontSize] = useState(DEFAULT_DESIGN.fontSize);
  const [titleFontSize, setTitleFontSize] = useState(24);
  const [headerFontSize, setHeaderFontSize] = useState(DEFAULT_DESIGN.headerFontSize);
  const [titleColor, setTitleColor] = useState(DEFAULT_DESIGN.titleColor);
  const [contentColor, setContentColor] = useState(DEFAULT_DESIGN.contentColor);
  const [headerColor, setHeaderColor] = useState(DEFAULT_DESIGN.headerColor);
  const [bulletColor, setBulletColor] = useState(DEFAULT_DESIGN.bulletColor || '#10b981');
  const [imageBorderRadius, setImageBorderRadius] = useState('0px');
  const [fontFamily, setFontFamily] = useState('Manrope');

  const [logoPos, setLogoPos] = useState({ x: 25, y: 12 });
  const [doctorNamePos, setDoctorNamePos] = useState({ x: 60, y: 12 });
  const [dividerPos, setDividerPos] = useState({ x: 50, y: 22 });
  const [dividerColor, setDividerColor] = useState('#e5e7eb');
  const [dividerHeight, setDividerHeight] = useState(2);
  const [dividerWidth, setDividerWidth] = useState(80);
  
  const [extraElements, setExtraElements] = useState({});
  const [currentSlidePage, setCurrentSlidePage] = useState(0);
  const [selectedExtraId, setSelectedExtraId] = useState(null);
  const [selectedImageId, setSelectedImageId] = useState(null);
  const [selectedContentIndex, setSelectedContentIndex] = useState(null);
  const [selectedLogo, setSelectedLogo] = useState(false);
  const [selectedDoctorName, setSelectedDoctorName] = useState(false);
  const [selectedDivider, setSelectedDivider] = useState(false);
  const [isExportMode, setIsExportMode] = useState(false);

  // Custom Templates Management (Keeping localStorage for now as they are small styles)
  const [customTemplates, setCustomTemplates] = useState(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(TEMPLATE_STORAGE_KEY) : null;
    return saved ? JSON.parse(saved) : [];
  });

  // Projects Management (Backend as source of truth, local as fallback)
  const [projects, setProjects] = useState([]);
  const [loadingProjects, setLoadingProjects] = useState(true);

  const fetchProjects = async () => {
    setLoadingProjects(true);
    try {
      const backendProjects = await blogService.getCarouselProjects();
      
      // Merge with local projects (avoiding duplicates if they were migrated)
      setProjects(prev => {
        const local = prev.filter(p => !p.is_backend); // Keep only truly local ones
        return [...backendProjects.map(p => ({ ...p, is_backend: true })), ...local];
      });
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoadingProjects(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const saveCustomTemplate = (name, type) => {
    if (!name) return;
    const newTemplate = {
      id: Date.now(),
      name,
      type,
      design: {
        bgColor, bgColor2, bgColor3, useBgGradient,
        fontSize, titleFontSize, headerFontSize,
        titleColor, contentColor, headerColor, bulletColor,
        imageBorderRadius
      },
      global: {
        logoPos, doctorNamePos, dividerPos, dividerColor, dividerHeight, dividerWidth
      },
      elements: extraElements[currentSlidePage] || []
    };

    const updated = [...customTemplates, newTemplate];
    setCustomTemplates(updated);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteTemplate = (id) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(updated));
  };

  const applyCustomTemplate = (template, totalSlides) => {
    if (!template) return;
    const { design, global, elements } = template;
    setBgColor(design.bgColor);
    setBgColor2(design.bgColor2);
    setBgColor3(design.bgColor3);
    setUseBgGradient(design.useBgGradient);
    setFontSize(design.fontSize);
    setTitleFontSize(design.titleFontSize || 24);
    setHeaderFontSize(design.headerFontSize);
    setTitleColor(design.titleColor || DEFAULT_DESIGN.titleColor);
    setContentColor(design.contentColor || DEFAULT_DESIGN.contentColor);
    setHeaderColor(design.headerColor || DEFAULT_DESIGN.headerColor);
    setBulletColor(design.bulletColor || DEFAULT_DESIGN.bulletColor || '#10b981');
    setImageBorderRadius(design.imageBorderRadius || '0px');
    setLogoPos(global.logoPos || { x: 25, y: 12 });
    setDoctorNamePos(global.doctorNamePos || { x: 60, y: 12 });
    setDividerPos(global.dividerPos);
    setDividerColor(global.dividerColor);
    setDividerHeight(global.dividerHeight);
    setDividerWidth(global.dividerWidth);
    const newExtraElements = {};
    for (let i = 0; i < totalSlides; i++) {
      newExtraElements[i] = elements.map(el => ({ 
        ...el, 
        id: Math.random().toString(36).substr(2, 9),
        bold: el.bold !== undefined ? el.bold : true,
        italic: el.italic !== undefined ? el.italic : false
      }));
    }
    setExtraElements(newExtraElements);
  };

  const saveProject = async (name, generatedContent, projectId = null) => {
    if (!name || !generatedContent) return null;
    const projectData = {
      name,
      type: generatedContent?.type || (generatedContent?.video_slides ? 'video' : 'carousel'),
      content: generatedContent,
      design: {
        bgColor, bgColor2, bgColor3, useBgGradient,
        fontSize, titleFontSize, headerFontSize,
        titleColor, contentColor, headerColor,
        imageBorderRadius
      },
      global_settings: {
        logoPos, doctorNamePos, dividerPos, dividerColor, dividerHeight, dividerWidth
      },
      elements: extraElements
    };
    
    // Include ID for overwrite
    if (projectId) {
      projectData.id = projectId;
    }
    
    try {
      let savedResult = null;
      if (projectId) {
        savedResult = await blogService.updateCarouselProject(projectId, projectData);
      } else {
        savedResult = await blogService.saveCarouselProject(projectData);
      }
      await fetchProjects();
      return savedResult || { id: projectId, name };
    } catch (error) {
      console.error('Error saving project:', error);
      return null;
    }
  };

  const deleteProject = async (id, isBackend) => {
    // --- OPTIMISTIC UPDATE: eliminar de estado local de inmediato ---
    let removedProject = null;
    setProjects(prev => {
      removedProject = prev.find(p => p.id === id);
      return prev.filter(p => p.id !== id);
    });

    try {
      if (isBackend) {
        await blogService.deleteCarouselProject(id);
      } else {
        const updated = projects.filter(p => p.id !== id);
        localStorage.setItem('arko360_carousel_projects', JSON.stringify(updated));
      }
      toast.success('Proyecto eliminado correctamente');
      return true;
    } catch (error) {
      // Restaurar el proyecto si falló el servidor
      if (removedProject) {
        setProjects(prev => [removedProject, ...prev]);
      }
      console.error('Error deleting project:', error);
      const msg = error.response?.data?.detail || 'No se pudo eliminar el proyecto';
      toast.error(msg);
      return false;
    }
  };

  const loadProject = (project) => {
    if (!project) return null;
    const { design, elements, content } = project;
    const global = project.global_settings || project.global;
    
    setBgColor(design.bgColor);
    setBgColor2(design.bgColor2);
    setBgColor3(design.bgColor3);
    setUseBgGradient(design.useBgGradient);
    setFontSize(design.fontSize);
    setTitleFontSize(design.titleFontSize || 24);
    setHeaderFontSize(design.headerFontSize);
    setTitleColor(design.titleColor);
    setContentColor(design.contentColor);
    setHeaderColor(design.headerColor);
    setImageBorderRadius(design.imageBorderRadius || '0px');
    
    if (global) {
      setLogoPos(global.logoPos || { x: 25, y: 12 });
      setDoctorNamePos(global.doctorNamePos || { x: 60, y: 12 });
      setDividerPos(global.dividerPos);
      setDividerColor(global.dividerColor);
      setDividerHeight(global.dividerHeight);
      setDividerWidth(global.dividerWidth);
    }
    
    setExtraElements(elements);
    setCurrentSlidePage(0);
    return content;
  };

  const addExtraElement = (slideIndex, type, content = '', fontFamily = 'Arial') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newElement = {
      id,
      type,
      content: content || (type === 'text' ? 'Nuevo Texto' : 'arrow'),
      x: 50,
      y: 50,
      width: type === 'text' ? 150 : 80,
      height: type === 'text' ? 40 : 80,
      rotation: 0,
      color: type === 'text' ? contentColor : titleColor,
      color2: '#4f46e5',
      color3: '#9333ea',
      useGradient: false,
      gradientDir: 'to bottom right',
      zIndex: (type === 'shape' || type === 'icon') ? 5 : 15,
      bold: true,
      italic: false,
      fontFamily: type === 'text' ? fontFamily : 'Arial'
    };
    setExtraElements(prev => {
      const slideElements = prev[slideIndex] || [];
      return { ...prev, [slideIndex]: [...slideElements, newElement] };
    });
    setSelectedExtraId(`${slideIndex}-${id}`);
  };

  const updateExtraElement = (slideIndex, elementId, updates) => {
    setExtraElements(prev => {
      const slideElements = prev[slideIndex] || [];
      const newElements = slideElements.map(el => el.id === elementId ? { ...el, ...updates } : el);
      return { ...prev, [slideIndex]: newElements };
    });
  };

  const removeExtraElement = (slideIndex, elementId) => {
    setExtraElements(prev => {
      const slideElements = prev[slideIndex] || [];
      const newElements = slideElements.filter(el => el.id !== elementId);
      return { ...prev, [slideIndex]: newElements };
    });
    setSelectedExtraId(null);
  };

  const duplicateExtraElement = (slideIndex, elementId) => {
    setExtraElements(prev => {
      const slideElements = prev[slideIndex] || [];
      const elementToDuplicate = slideElements.find(el => el.id === elementId);
      if (!elementToDuplicate) return prev;
      
      const newId = Date.now().toString();
      const newElement = {
        ...elementToDuplicate,
        id: newId,
        x: Math.min(elementToDuplicate.x + 5, 90),
        y: Math.min(elementToDuplicate.y + 5, 90),
        zIndex: (slideElements.length || 0) + 30
      };
      
      return { ...prev, [slideIndex]: [...slideElements, newElement] };
    });
  };

  const selectElement = (type, id) => {
    setSelectedLogo(type === 'logo');
    setSelectedDoctorName(type === 'doctorName');
    setSelectedDivider(type === 'divider');
    setSelectedImageId(type === 'image' ? id : null);
    setSelectedContentIndex(type === 'content' ? id : null);
    setSelectedExtraId(type === 'extra' ? id : null);
  };

  const applyTemplateToAll = (totalSlides) => {
    const currentElements = extraElements[currentSlidePage] || [];
    const newExtraElements = {};
    for (let i = 0; i < totalSlides; i++) {
      newExtraElements[i] = currentElements.map(el => ({ ...el, id: Math.random().toString(36).substr(2, 9) }));
    }
    setExtraElements(newExtraElements);
  };

  return {
    design: {
      bgColor, setBgColor,
      bgColor2, setBgColor2,
      bgColor3, setBgColor3,
      useBgGradient, setUseBgGradient,
      fontSize, setFontSize,
      titleFontSize, setTitleFontSize,
      headerFontSize, setHeaderFontSize,
      titleColor, setTitleColor,
      contentColor, setContentColor,
      headerColor, setHeaderColor,
      bulletColor, setBulletColor,
      logoPos, setLogoPos,
      doctorNamePos, setDoctorNamePos,
      dividerPos, setDividerPos,
      dividerColor, setDividerColor,
      dividerHeight, setDividerHeight,
      dividerWidth, setDividerWidth,
      imageBorderRadius, setImageBorderRadius,
      fontFamily, setFontFamily
    },
    canvas: {
      extraElements, setExtraElements,
      currentSlidePage, setCurrentSlidePage,
      selectedExtraId, setSelectedExtraId,
      selectedImageId, setSelectedImageId,
      selectedContentIndex, setSelectedContentIndex,
      selectedLogo,
      selectedDoctorName,
      selectedDivider,
      logoPos,
      doctorNamePos,
      dividerPos,
      dividerColor,
      dividerHeight,
      dividerWidth,
      addExtraElement,
      updateExtraElement,
      removeExtraElement,
      duplicateExtraElement,
      selectElement,
      applyTemplateToAll,
      isExportMode,
      setIsExportMode,
      customTemplates,
      saveCustomTemplate,
      applyCustomTemplate,
      deleteTemplate,
      projects,
      loadingProjects,
      saveProject,
      loadProject,
      deleteProject
    }
  };
};

