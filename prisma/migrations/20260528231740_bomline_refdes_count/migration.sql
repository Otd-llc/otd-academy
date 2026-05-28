ALTER TABLE "BomLine"
ADD CONSTRAINT bomline_refdes_count CHECK (
  array_length(string_to_array("refDes", ','), 1) = "quantity"
);
