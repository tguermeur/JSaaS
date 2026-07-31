import React from 'react';
import { Box, Typography, Breadcrumbs, Link } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { tokens } from '../../theme/tokens';
import { fadeIn } from '../../styles/animations';

interface BreadcrumbItem {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  action?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, breadcrumbs, action }) => {
  return (
    <Box
      sx={{
        mb: 4,
        animation: `${fadeIn} 0.5s ease-out`,
      }}
    >
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumbs
          separator={<NavigateNextIcon sx={{ fontSize: 16 }} />}
          sx={{ mb: 1 }}
        >
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            if (isLast) {
              return (
                <Typography
                  key={index}
                  sx={{ fontSize: '13px', color: tokens.colors.textSecondary }}
                >
                  {crumb.label}
                </Typography>
              );
            }
            return (
              <Link
                key={index}
                href={crumb.href}
                onClick={crumb.onClick}
                underline="hover"
                sx={{
                  fontSize: '13px',
                  color: tokens.colors.textSecondary,
                  cursor: 'pointer',
                  '&:hover': { color: tokens.colors.primary },
                }}
              >
                {crumb.label}
              </Link>
            );
          })}
        </Breadcrumbs>
      )}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              ...tokens.typography.pageTitle,
              color: tokens.colors.textPrimary,
            }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              sx={{
                color: tokens.colors.textSecondary,
                fontSize: '14px',
                mt: 0.5,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {action && <Box>{action}</Box>}
      </Box>
    </Box>
  );
};

export default PageHeader;
