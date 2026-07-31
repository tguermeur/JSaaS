import { useEffect } from 'react';

interface PageMetaProps {
  title: string;
  description?: string;
}

const PageMeta: React.FC<PageMetaProps> = ({ title, description }) => {
  useEffect(() => {
    document.title = title.includes('JS Connect') ? title : `${title} | JS Connect`;
    if (description) {
      let meta = document.querySelector('meta[name="description"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'description');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', description);
    }
  }, [title, description]);

  return null;
};

export default PageMeta;
