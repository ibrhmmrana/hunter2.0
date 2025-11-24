import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Button,
  Box,
  CardMedia,
} from "@mui/material";

interface HorizontalCardProps {
  imageUrl?: string;
  imageWidth?: number;
  title: string;
  subtitle?: string;
  body?: string;
  ctaLabel?: string;
  ctaOnClick?: () => void;
}

export function HorizontalCard({
  imageUrl,
  imageWidth = 120,
  title,
  subtitle,
  body,
  ctaLabel,
  ctaOnClick,
}: HorizontalCardProps) {
  return (
    <Card>
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" } }}>
        {imageUrl ? (
          <CardMedia
            component="img"
            sx={{
              width: { xs: "100%", sm: imageWidth },
              height: { xs: 200, sm: imageWidth },
              objectFit: "cover",
            }}
            image={imageUrl}
            alt={title}
          />
        ) : (
          <Box
            sx={{
              width: { xs: "100%", sm: imageWidth },
              height: { xs: 200, sm: imageWidth },
              backgroundColor: "surface.variant",
              borderRadius: { xs: "16px 16px 0 0", sm: "16px 0 0 16px" },
            }}
          />
        )}
        <Box sx={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <CardContent sx={{ flex: 1 }}>
            <Typography variant="h6" sx={{ mb: 0.5 }}>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {subtitle}
              </Typography>
            )}
            {body && (
              <Typography variant="body2" color="text.secondary">
                {body}
              </Typography>
            )}
          </CardContent>
          {ctaLabel && (
            <CardActions sx={{ px: 2, pb: 2 }}>
              <Button variant="contained" onClick={ctaOnClick} size="small">
                {ctaLabel}
              </Button>
            </CardActions>
          )}
        </Box>
      </Box>
    </Card>
  );
}


