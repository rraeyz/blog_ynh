// Alt menü: gizliyken en aşağı, görünürken en yukarı noktayı izler; yukarı 3 px menüyü getirir,
// gizlemek için 8 px iner (parmak titremesi ve Chrome'un adres çubuğu gizlemesin)
export function navStep(hidden: boolean, last: number, y: number): [boolean, number] {
  if (y <= 80) return [false, y]
  if (hidden ? y > last : y < last) return [hidden, y]
  if (hidden ? y <= last - 3 : y >= last + 8) return [!hidden, y]
  return [hidden, last]
}
